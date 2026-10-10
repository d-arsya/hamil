"""BidanKu backend API tests: auth, dashboard, patients CRUD, checkups, persalinan."""
import os
import re
from datetime import date, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

ANC_WEEKS = [12, 16, 26, 32, 36, 39]
KF_DAYS = [2, 7, 14, 42]


@pytest.fixture(scope="session")
def test_credentials():
    p = Path("/app/memory/test_credentials.md")
    if not p.exists():
        pytest.skip("missing credentials file")
    c = p.read_text(encoding="utf-8")
    u = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?username(?:\*\*)?\s*:\s*`?([^`\s]+)', c)
    pw = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)', c)
    if not u or not pw:
        pytest.skip("no creds parsed")
    return {"username": u.group(1), "password": pw.group(1)}


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token(api_client, test_credentials):
    r = api_client.post(f"{BASE_URL}/api/auth/login", json=test_credentials, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    tok = r.json().get("token")
    if not tok:
        pytest.fail("no token in login response")
    return tok


@pytest.fixture(scope="session")
def client(api_client, auth_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {auth_token}"})
    return s


@pytest.fixture(scope="session")
def created_ids():
    return []


@pytest.fixture(scope="session", autouse=True)
def cleanup(client, created_ids):
    yield
    for pid in created_ids:
        try:
            client.delete(f"{BASE_URL}/api/patients/{pid}", timeout=30)
        except Exception:
            pass


# ---------- AUTH ----------
class TestAuth:
    def test_login_success(self, api_client, test_credentials):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json=test_credentials, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["token"], str) and len(d["token"]) > 20
        assert d["user"]["username"] == test_credentials["username"]

    def test_login_wrong_password(self, api_client, test_credentials):
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"username": test_credentials["username"], "password": "salahbanget"}, timeout=30)
        assert r.status_code == 401
        assert "salah" in r.json().get("detail", "").lower()

    def test_login_unknown_user(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"username": "TEST_nouser", "password": "x"}, timeout=30)
        assert r.status_code == 401

    def test_login_missing_field_422(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"username": "admin"}, timeout=30)
        assert r.status_code == 422

    def test_me_with_token(self, client, test_credentials):
        r = client.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["username"] == test_credentials["username"]
        assert "password_hash" not in d

    def test_me_without_token(self, api_client):
        api_client.cookies.clear()
        r = api_client.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert r.status_code == 401

    def test_me_bad_token(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me",
                           headers={"Authorization": "Bearer abc.def.ghi"}, timeout=30)
        assert r.status_code == 401

    def test_bcrypt_hash_format(self):
        """Verify stored admin hash is bcrypt $2b$"""
        from dotenv import dotenv_values as dv
        from pymongo import MongoClient
        be = dv("/app/backend/.env")
        c = MongoClient(be["MONGO_URL"])
        u = c[be["DB_NAME"]].users.find_one({"username": "admin"})
        assert u is not None, "admin user not seeded"
        assert u["password_hash"].startswith("$2b$"), f"hash prefix: {u['password_hash'][:7]}"
        assert "$" not in be.get("ADMIN_PASSWORD", ""), "ADMIN_PASSWORD contains $ (env expansion risk)"


# ---------- PROTECTED ROUTES ----------
class TestAuthProtection:
    @pytest.mark.parametrize("method,path", [
        ("get", "/api/dashboard"),
        ("get", "/api/patients"),
        ("post", "/api/patients"),
        ("delete", "/api/patients/xyz"),
    ])
    def test_requires_auth(self, api_client, method, path):
        api_client.cookies.clear()
        r = getattr(api_client, method)(f"{BASE_URL}{path}", json={}, timeout=30)
        assert r.status_code == 401, f"{path} -> {r.status_code}"


# ---------- DASHBOARD ----------
class TestDashboard:
    def test_dashboard_shape(self, client):
        r = client.get(f"{BASE_URL}/api/dashboard", timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["total", "hamil", "nifas", "hari_ini", "terlambat", "mendekati"]:
            assert k in d["stats"] and isinstance(d["stats"][k], int)
        assert isinstance(d["perlu_tindakan"], list)
        for p in d["perlu_tindakan"]:
            assert p["status"] in ("terlambat", "hari_ini", "mendekati")
            assert "_id" not in p


# ---------- PATIENTS CRUD ----------
class TestPatients:
    def test_list_patients(self, client):
        r = client.get(f"{BASE_URL}/api/patients", timeout=60)
        assert r.status_code == 200, r.text
        lst = r.json()
        assert isinstance(lst, list)
        for p in lst:
            assert "_id" not in p
            assert {"id", "nama", "no_wa", "hpht", "status", "fase"} <= set(p)

    def test_create_patient_schedule_and_persistence(self, client, created_ids):
        hpht = (date.today() - timedelta(days=70)).isoformat()
        payload = {"nama": "TEST_Ibu Coba", "no_wa": "081234567890", "alamat": "Jl. Test 1",
                   "hpht": hpht, "gravida": 2, "para": 1, "abortus": 0, "riwayat": "Riwayat test"}
        r = client.post(f"{BASE_URL}/api/patients", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        p = r.json()
        created_ids.append(p["id"])
        assert p["nama"] == "TEST_Ibu Coba"
        assert p["no_wa"] == "081234567890"
        assert p["gravida"] == 2 and p["para"] == 1
        h = date.fromisoformat(hpht)
        assert p["hpl"] == (h + timedelta(days=280)).isoformat()
        assert p["jadwal_berikutnya"] == (h + timedelta(weeks=12)).isoformat()
        assert p["kunjungan_berikutnya"] == "K1"
        assert p["fase"] == "trimester_1"
        assert p["jumlah_kontrol"] == 0

        g = client.get(f"{BASE_URL}/api/patients/{p['id']}", timeout=30)
        assert g.status_code == 200
        gd = g.json()
        assert gd["pasien"]["nama"] == "TEST_Ibu Coba"
        assert gd["checkups"] == []

    def test_create_invalid_hpht(self, client):
        r = client.post(f"{BASE_URL}/api/patients",
                        json={"nama": "TEST_Bad", "no_wa": "0812", "hpht": "bukan-tanggal"}, timeout=30)
        assert r.status_code in (400, 422), f"expected 4xx got {r.status_code}: {r.text[:200]}"

    def test_update_patient(self, client, created_ids):
        hpht = (date.today() - timedelta(days=100)).isoformat()
        c = client.post(f"{BASE_URL}/api/patients",
                        json={"nama": "TEST_Edit Awal", "no_wa": "081000000001", "hpht": hpht}, timeout=30)
        pid = c.json()["id"]
        created_ids.append(pid)
        u = client.put(f"{BASE_URL}/api/patients/{pid}",
                       json={"nama": "TEST_Edit Baru", "no_wa": "081000000001",
                             "alamat": "Alamat Baru", "hpht": hpht}, timeout=30)
        assert u.status_code == 200, u.text
        assert u.json()["nama"] == "TEST_Edit Baru"
        g = client.get(f"{BASE_URL}/api/patients/{pid}", timeout=30).json()["pasien"]
        assert g["nama"] == "TEST_Edit Baru"
        assert g["alamat"] == "Alamat Baru"

    def test_get_missing_patient_404(self, client):
        r = client.get(f"{BASE_URL}/api/patients/does-not-exist", timeout=30)
        assert r.status_code == 404

    def test_update_missing_patient_404(self, client):
        r = client.put(f"{BASE_URL}/api/patients/does-not-exist",
                       json={"nama": "x", "no_wa": "1", "hpht": date.today().isoformat()}, timeout=30)
        assert r.status_code == 404

    def test_delete_patient_and_cascade(self, client):
        hpht = (date.today() - timedelta(days=120)).isoformat()
        pid = client.post(f"{BASE_URL}/api/patients",
                          json={"nama": "TEST_Hapus", "no_wa": "081000000002", "hpht": hpht},
                          timeout=30).json()["id"]
        chk = client.post(f"{BASE_URL}/api/patients/{pid}/checkups",
                          json={"tanggal": date.today().isoformat(), "sistolik": 110,
                                "diastolik": 70, "berat_badan": 55.5}, timeout=30)
        assert chk.status_code == 200
        d = client.delete(f"{BASE_URL}/api/patients/{pid}", timeout=30)
        assert d.status_code == 200 and d.json().get("ok") is True
        assert client.get(f"{BASE_URL}/api/patients/{pid}", timeout=30).status_code == 404
        assert client.delete(f"{BASE_URL}/api/patients/{pid}", timeout=30).status_code == 404


# ---------- CHECKUPS ----------
class TestCheckups:
    def test_checkup_flow_and_status_progress(self, client, created_ids):
        hpht = (date.today() - timedelta(weeks=20)).isoformat()
        h = date.fromisoformat(hpht)
        pid = client.post(f"{BASE_URL}/api/patients",
                          json={"nama": "TEST_Kontrol", "no_wa": "081000000003", "hpht": hpht},
                          timeout=30).json()["id"]
        created_ids.append(pid)
        r = client.post(f"{BASE_URL}/api/patients/{pid}/checkups",
                        json={"tanggal": date.today().isoformat(), "sistolik": 120, "diastolik": 80,
                              "berat_badan": 60.2, "tinggi_fundus": 20, "djj": 140,
                              "keluhan": "mual", "catatan": "ok"}, timeout=30)
        assert r.status_code == 200, r.text
        c = r.json()
        assert "_id" not in c
        assert c["jenis"] == "anc" and c["ke"] == 1
        assert c["sistolik"] == 120 and c["diastolik"] == 80 and c["berat_badan"] == 60.2

        det = client.get(f"{BASE_URL}/api/patients/{pid}", timeout=30).json()
        assert len(det["checkups"]) == 1
        pas = det["pasien"]
        assert pas["jumlah_kontrol"] == 1
        assert pas["kunjungan_berikutnya"] == "K2"
        assert pas["jadwal_berikutnya"] == (h + timedelta(weeks=16)).isoformat()
        assert pas["status"] == "sudah_kontrol", f"got {pas['status']}"

        # delete checkup
        dc = client.delete(f"{BASE_URL}/api/checkups/{c['id']}", timeout=30)
        assert dc.status_code == 200
        det2 = client.get(f"{BASE_URL}/api/patients/{pid}", timeout=30).json()
        assert det2["checkups"] == []
        assert det2["pasien"]["kunjungan_berikutnya"] == "K1"

    def test_checkup_default_today(self, client, created_ids):
        hpht = (date.today() - timedelta(weeks=30)).isoformat()
        pid = client.post(f"{BASE_URL}/api/patients",
                          json={"nama": "TEST_Default", "no_wa": "081000000004", "hpht": hpht},
                          timeout=30).json()["id"]
        created_ids.append(pid)
        r = client.post(f"{BASE_URL}/api/patients/{pid}/checkups", json={}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["tanggal"] == date.today().isoformat()

    def test_checkup_missing_patient_404(self, client):
        r = client.post(f"{BASE_URL}/api/patients/nope/checkups", json={}, timeout=30)
        assert r.status_code == 404

    def test_delete_missing_checkup_404(self, client):
        r = client.delete(f"{BASE_URL}/api/checkups/nope", timeout=30)
        assert r.status_code == 404

    def test_checkup_invalid_date(self, client, created_ids):
        hpht = (date.today() - timedelta(weeks=30)).isoformat()
        pid = client.post(f"{BASE_URL}/api/patients",
                          json={"nama": "TEST_BadDate", "no_wa": "081000000009", "hpht": hpht},
                          timeout=30).json()["id"]
        created_ids.append(pid)
        r = client.post(f"{BASE_URL}/api/patients/{pid}/checkups",
                        json={"tanggal": "31-12-2026"}, timeout=30)
        assert r.status_code in (400, 422), f"expected 4xx got {r.status_code}"


# ---------- PERSALINAN / NIFAS ----------
class TestPersalinan:
    def test_mark_delivery_switches_to_nifas(self, client, created_ids):
        hpht = (date.today() - timedelta(weeks=40)).isoformat()
        pid = client.post(f"{BASE_URL}/api/patients",
                          json={"nama": "TEST_Nifas", "no_wa": "081000000005", "hpht": hpht},
                          timeout=30).json()["id"]
        created_ids.append(pid)
        tgl = date.today().isoformat()
        r = client.put(f"{BASE_URL}/api/patients/{pid}/persalinan",
                       json={"tanggal_persalinan": tgl}, timeout=30)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["fase"] == "nifas"
        assert p["kunjungan_berikutnya"] == "KF1"
        assert p["jadwal_berikutnya"] == (date.fromisoformat(tgl) + timedelta(days=2)).isoformat()
        assert p["hari_nifas"] == 0

        # kf checkup
        c = client.post(f"{BASE_URL}/api/patients/{pid}/checkups",
                        json={"tanggal": tgl, "sistolik": 115, "diastolik": 75}, timeout=30)
        assert c.status_code == 200 and c.json()["jenis"] == "kf"
        pas = client.get(f"{BASE_URL}/api/patients/{pid}", timeout=30).json()["pasien"]
        assert pas["kunjungan_berikutnya"] == "KF2"
        assert pas["jadwal_berikutnya"] == (date.fromisoformat(tgl) + timedelta(days=7)).isoformat()

    def test_persalinan_missing_patient_404(self, client):
        r = client.put(f"{BASE_URL}/api/patients/nope/persalinan",
                       json={"tanggal_persalinan": date.today().isoformat()}, timeout=30)
        assert r.status_code == 404

    def test_persalinan_invalid_date(self, client, created_ids):
        hpht = (date.today() - timedelta(weeks=40)).isoformat()
        pid = client.post(f"{BASE_URL}/api/patients",
                          json={"nama": "TEST_BadDeliv", "no_wa": "081000000006", "hpht": hpht},
                          timeout=30).json()["id"]
        created_ids.append(pid)
        r = client.put(f"{BASE_URL}/api/patients/{pid}/persalinan",
                       json={"tanggal_persalinan": "aaa"}, timeout=30)
        assert r.status_code in (400, 422), f"expected 4xx got {r.status_code}"


# ---------- SECURITY: brute force ----------
class TestBruteForce:
    BF_CREDS = {"username": "test_bruteforce_user", "password": "Brute#Test123"}

    def test_lockout_after_5_failures(self, api_client, test_credentials):
        import subprocess
        # bersihkan dulu + pakai user khusus agar akun admin tidak ikut terkunci saat suite paralel
        subprocess.run(["mongosh", os.environ.get("DB_NAME", "test_database"), "--quiet",
                        "--eval", 'db.login_attempts.deleteMany({"username": "test_bruteforce_user"})'], capture_output=True, check=False)
        ok0 = api_client.post(f"{BASE_URL}/api/auth/login", json=test_credentials, timeout=30)
        assert ok0.status_code == 200, ok0.text
        ah = {"Authorization": f"Bearer {ok0.json()['token']}"}
        api_client.post(f"{BASE_URL}/api/auth/users",
                        json={"username": self.BF_CREDS["username"], "nama": "Test Brute Force", "password": self.BF_CREDS["password"]},
                        headers=ah, timeout=30)
        codes = []
        for _ in range(6):
            r = api_client.post(f"{BASE_URL}/api/auth/login",
                                json={"username": self.BF_CREDS["username"], "password": "wrong-bf"}, timeout=30)
            codes.append(r.status_code)
        assert 429 in codes, f"no rate limit/lockout, codes={codes}"
        # cleanup: never leave the account locked out for the next agent/user
        subprocess.run(["mongosh", os.environ.get("DB_NAME", "test_database"), "--quiet",
                        "--eval", 'db.login_attempts.deleteMany({"username": "test_bruteforce_user"})'], capture_output=True, check=False)
        ok = api_client.post(f"{BASE_URL}/api/auth/login", json=self.BF_CREDS, timeout=30)
        assert ok.status_code == 200, f"user still locked after cleanup: {ok.status_code}"
