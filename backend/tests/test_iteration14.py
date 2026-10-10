"""Iteration 14 backend tests: pengaturan, followup, laporan extras, pemantauan, auth users, pasien ttd/janji."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://antenatal-postnatal.preview.emergentagent.com").rstrip("/")
ADMIN_USER = "admin"
ADMIN_PASS = "Bidan#Aman2026xY9"


# ---------------- fixtures ----------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def patient_id(h):
    """Create a TEST patient with full data; cleanup at end."""
    ts = int(time.time())
    payload = {
        "nama": f"TEST_iter14_{ts}",
        "no_wa": "081234567890",
        "no_rm": f"RM{ts}",
        "tanggal_lahir": "1995-01-01",
        "alamat": "Jl. Test 1",
        "hpht": "2025-07-01",
        "gravida": 1, "paritas": 0, "abortus": 0,
    }
    r = requests.post(f"{BASE_URL}/api/patients", json=payload, headers=h, timeout=20)
    assert r.status_code in (200, 201), r.text
    pid = r.json()["id"]
    yield pid
    requests.delete(f"{BASE_URL}/api/patients/{pid}", headers=h, timeout=20)


@pytest.fixture(scope="module")
def pasien_token(h, patient_id):
    """Create portal akun for the patient and return pasien JWT."""
    r = requests.post(f"{BASE_URL}/api/patients/{patient_id}/akun", headers=h, timeout=20)
    assert r.status_code == 200, r.text
    creds = r.json()
    u, p = creds["username"], creds["password"]
    rl = requests.post(f"{BASE_URL}/api/pasien/login", json={"username": u, "password": p}, timeout=20)
    assert rl.status_code == 200, rl.text
    return rl.json()["token"]


@pytest.fixture
def ph(pasien_token):
    return {"Authorization": f"Bearer {pasien_token}"}


# ---------------- /api/pengaturan ----------------
class TestPengaturan:
    def test_get(self, h):
        r = requests.get(f"{BASE_URL}/api/pengaturan", headers=h, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "wa_bidan" in d and "template_janji" in d and "template_followup" in d

    def test_put_normalize_08xx(self, h):
        r = requests.put(f"{BASE_URL}/api/pengaturan", headers=h, timeout=15,
                         json={"wa_bidan": "081234567890", "template_janji": "Halo {nama} jadwal {jadwal}",
                               "template_followup": "FU {nama} {kunjungan}"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["wa_bidan"] == "6281234567890"
        assert "{nama}" in d["template_janji"]
        assert d["template_followup"].startswith("FU")

    def test_put_rejects_short(self, h):
        r = requests.put(f"{BASE_URL}/api/pengaturan", headers=h, timeout=15, json={"wa_bidan": "0812"})
        assert r.status_code == 400

    def test_put_empty_wa_ok(self, h):
        # restore
        r = requests.put(f"{BASE_URL}/api/pengaturan", headers=h, timeout=15,
                         json={"wa_bidan": "6281234567890", "template_janji": "Halo {nama}", "template_followup": "FU {nama}"})
        assert r.status_code == 200


# ---------------- /api/followup ----------------
class TestFollowup:
    def test_list(self, h, patient_id):
        r = requests.get(f"{BASE_URL}/api/followup", headers=h, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "minggu" in d and "template" in d and isinstance(d["items"], list)
        ids = [it["id"] for it in d["items"]]
        assert patient_id in ids
        it = next(it for it in d["items"] if it["id"] == patient_id)
        assert it["sudah_followup"] is False

    def test_mark_and_reflect(self, h, patient_id):
        r = requests.post(f"{BASE_URL}/api/followup/{patient_id}", headers=h, timeout=15)
        assert r.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/followup", headers=h, timeout=15)
        it = next(it for it in r2.json()["items"] if it["id"] == patient_id)
        assert it["sudah_followup"] is True
        assert it["followup_at"] is not None

    def test_mark_404(self, h):
        r = requests.post(f"{BASE_URL}/api/followup/nonexistent-id-xyz", headers=h, timeout=15)
        assert r.status_code == 404


# ---------------- /api/laporan extras ----------------
class TestLaporan:
    def test_contains_new_fields(self, h):
        r = requests.get(f"{BASE_URL}/api/laporan", headers=h, timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("perlu_followup", "perlu_followup_list", "perlu_update", "perlu_update_list"):
            assert k in d
        assert isinstance(d["perlu_followup_list"], list)
        assert isinstance(d["perlu_update_list"], list)


# ---------------- /api/patients/{id}/pemantauan ----------------
class TestPatientPemantauan:
    def test_endpoint(self, h, patient_id):
        r = requests.get(f"{BASE_URL}/api/patients/{patient_id}/pemantauan", headers=h, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("harian", "mingguan", "ttd", "gerakan"):
            assert k in d and isinstance(d[k], list)

    def test_404(self, h):
        r = requests.get(f"{BASE_URL}/api/patients/does-not-exist/pemantauan", headers=h, timeout=15)
        assert r.status_code == 404

    def test_patient_list_includes_pantau_after_bahaya(self, h, patient_id, ph):
        # patient submits pemantauan with bahaya
        today = time.strftime("%Y-%m-%d")
        r = requests.post(f"{BASE_URL}/api/pasien/pemantauan", headers=ph, timeout=15,
                         json={"tanggal": today, "tekanan_darah_sistol": 150, "tekanan_darah_diastol": 100,
                               "berat_kg": 60.0, "keluhan": "sakit kepala hebat", "kondisi": "pusing"})
        assert r.status_code == 200, r.text
        rl = requests.get(f"{BASE_URL}/api/patients", headers=h, timeout=15)
        assert rl.status_code == 200
        rec = next((p for p in rl.json() if p["id"] == patient_id), None)
        assert rec is not None
        assert "pantau" in rec, f"missing pantau; patient keys = {list(rec.keys())}"
        assert rec["pantau"]["tanggal"] == today


# ---------------- /api/auth/users ----------------
class TestAuthUsers:
    _created_username = None

    def test_list(self, h):
        r = requests.get(f"{BASE_URL}/api/auth/users", headers=h, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert any(u["username"] == "admin" for u in r.json())

    def test_create_short_pw(self, h):
        r = requests.post(f"{BASE_URL}/api/auth/users", headers=h, timeout=15,
                         json={"username": f"tst{int(time.time())}", "nama": "x", "password": "short"})
        assert r.status_code == 400

    def test_create_invalid_username(self, h):
        r = requests.post(f"{BASE_URL}/api/auth/users", headers=h, timeout=15,
                         json={"username": "AB!!", "nama": "x", "password": "longenough1"})
        assert r.status_code == 400

    def test_create_and_login_and_duplicate(self, h):
        uname = f"tst_i14_{int(time.time())}"
        pw = "Password123"
        r = requests.post(f"{BASE_URL}/api/auth/users", headers=h, timeout=15,
                         json={"username": uname, "nama": "TEST I14", "password": pw})
        assert r.status_code == 200, r.text
        assert r.json()["username"] == uname
        TestAuthUsers._created_username = uname
        # duplicate
        r2 = requests.post(f"{BASE_URL}/api/auth/users", headers=h, timeout=15,
                          json={"username": uname, "nama": "Dup", "password": pw})
        assert r2.status_code == 400
        # login
        rl = requests.post(f"{BASE_URL}/api/auth/login", json={"username": uname, "password": pw}, timeout=15)
        assert rl.status_code == 200
        assert "token" in rl.json()


# ---------------- /api/pasien/ttd past-date validation ----------------
class TestPasienTtd:
    def test_future_rejected(self, ph):
        r = requests.post(f"{BASE_URL}/api/pasien/ttd", headers=ph, timeout=15,
                         json={"tanggal": "2099-01-01", "status": "sudah"})
        assert r.status_code == 400

    def test_past_no_reason_rejected(self, ph):
        # pick a date in the past (yesterday)
        from datetime import date, timedelta
        past = (date.today() - timedelta(days=2)).isoformat()
        r = requests.post(f"{BASE_URL}/api/pasien/ttd", headers=ph, timeout=15,
                         json={"tanggal": past, "status": "sudah"})
        assert r.status_code == 400

    def test_past_with_reason_ok(self, ph):
        from datetime import date, timedelta
        past = (date.today() - timedelta(days=3)).isoformat()
        r = requests.post(f"{BASE_URL}/api/pasien/ttd", headers=ph, timeout=15,
                         json={"tanggal": past, "status": "sudah", "alasan": "lupa"})
        assert r.status_code == 200
        g = requests.get(f"{BASE_URL}/api/pasien/ttd", headers=ph, timeout=15)
        assert g.status_code == 200
        rec = next((x for x in g.json() if x["tanggal"] == past), None)
        assert rec is not None and rec["alasan"] == "lupa"


# ---------------- /api/pasien/janji ----------------
class TestPasienJanji:
    def test_renders_template(self, ph, h):
        # ensure settings have WA + template with {nama}
        requests.put(f"{BASE_URL}/api/pengaturan", headers=h, timeout=15,
                     json={"wa_bidan": "6281234567890",
                           "template_janji": "Halo bidan, saya {nama} ingin kontrol pada {jadwal}",
                           "template_followup": "FU"})
        r = requests.get(f"{BASE_URL}/api/pasien/janji", headers=ph, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["wa_bidan"] == "6281234567890"
        assert "{nama}" not in d["pesan"]  # template substituted
        assert "TEST_iter14" in d["pesan"]
