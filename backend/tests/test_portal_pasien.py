"""Iteration 10 — Portal Pasien tests.
Covers: akun create/reset/get, pasien login, isolation (klinik token vs pasien token),
onboarding profil, pemantauan harian + danger detection, mingguan, ttd, gerakan ($inc),
persiapan, pengingat, edukasi-klinik sync.
Cleans up all TEST_portal_* data on teardown.
"""
import os
import pytest
import requests
from datetime import date
from pathlib import Path
import re

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://antenatal-postnatal.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _admin_password():
    m = re.search(r"Password:\s*`([^`]+)`", Path("/app/memory/test_credentials.md").read_text())
    return m.group(1)


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": _admin_password()})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def test_patient(admin_headers):
    """Create a TEST_portal_* patient to use for the whole module."""
    payload = {
        "nama": "TEST_portal_Ibu",
        "umur": 28,
        "no_wa": "081200000001",
        "hpht": (date.today().replace(day=1)).isoformat(),  # ~current month, trimester 1-ish depends on HPHT
        "alamat": "TEST address",
        "pendidikan": "SMA",
        "pekerjaan": "IRT",
        "faskes": "Puskesmas TEST",
        "nama_pendamping": "",
        "kontak_darurat": "",
        "golongan_darah": "",
    }
    # Use an HPHT that places pasien at ~28 weeks (so gerakan tests are not blocked at <24w,
    # though gerakan lock is enforced on FE, BE does not block)
    from datetime import timedelta
    payload["hpht"] = (date.today() - timedelta(weeks=28)).isoformat()
    r = requests.post(f"{API}/patients", json=payload, headers=admin_headers)
    assert r.status_code in (200, 201), r.text
    pid = r.json()["id"]
    yield pid
    # Teardown handled in module-level fixture below


@pytest.fixture(scope="module")
def akun_cred(admin_headers, test_patient):
    r = requests.post(f"{API}/patients/{test_patient}/akun", headers=admin_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "username" in data and "password" in data
    return data


@pytest.fixture(scope="module")
def pasien_token(akun_cred):
    r = requests.post(f"{API}/pasien/login", json={"username": akun_cred["username"], "password": akun_cred["password"]})
    assert r.status_code == 200, r.text
    assert "token" in r.json()
    return r.json()["token"]


@pytest.fixture(scope="module")
def pasien_headers(pasien_token):
    return {"Authorization": f"Bearer {pasien_token}"}


# ---------- AKUN ----------
class TestAkun:
    def test_get_akun_exists(self, admin_headers, test_patient, akun_cred):
        r = requests.get(f"{API}/patients/{test_patient}/akun", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["ada"] is True
        assert r.json()["username"] == akun_cred["username"]

    def test_reset_password(self, admin_headers, test_patient, akun_cred):
        r = requests.post(f"{API}/patients/{test_patient}/akun", headers=admin_headers)
        assert r.status_code == 200
        new = r.json()
        assert new["password"] != akun_cred["password"]
        # Old password should NO LONGER work
        old = requests.post(f"{API}/pasien/login", json={"username": akun_cred["username"], "password": akun_cred["password"]})
        assert old.status_code == 401
        # New password works
        ok = requests.post(f"{API}/pasien/login", json={"username": new["username"], "password": new["password"]})
        assert ok.status_code == 200
        # Update module cred so later tests still work
        akun_cred["username"] = new["username"]
        akun_cred["password"] = new["password"]

    def test_create_akun_patient_not_found(self, admin_headers):
        r = requests.post(f"{API}/patients/nonexistent-id/akun", headers=admin_headers)
        assert r.status_code == 404

    def test_akun_requires_admin(self, test_patient):
        r = requests.post(f"{API}/patients/{test_patient}/akun")
        assert r.status_code in (401, 403)


# ---------- LOGIN ----------
class TestLogin:
    def test_login_wrong_password(self, akun_cred):
        r = requests.post(f"{API}/pasien/login", json={"username": akun_cred["username"], "password": "wrong"})
        assert r.status_code == 401

    def test_login_unknown_user(self):
        r = requests.post(f"{API}/pasien/login", json={"username": "doesnotexist9999", "password": "x"})
        assert r.status_code == 401


# ---------- ISOLATION ----------
class TestIsolation:
    def test_pasien_token_blocked_on_klinik(self, pasien_headers):
        r = requests.get(f"{API}/patients", headers=pasien_headers)
        assert r.status_code in (401, 403)

    def test_pasien_me_without_token(self):
        r = requests.get(f"{API}/pasien/me")
        assert r.status_code in (401, 403)

    def test_admin_token_blocked_on_pasien(self, admin_headers):
        # admin token has role 'admin' not 'pasien' → should get 403
        r = requests.get(f"{API}/pasien/me", headers=admin_headers)
        assert r.status_code == 403


# ---------- /pasien/me + profil ----------
class TestMeProfil:
    def test_me(self, pasien_headers, test_patient):
        r = requests.get(f"{API}/pasien/me", headers=pasien_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["pasien"]["id"] == test_patient
        assert "timeline" in data and "checkups" in data

    def test_profil_update_and_persist(self, pasien_headers):
        payload = {
            "golongan_darah": "O+",
            "nama_pendamping": "Suami TEST",
            "kontak_darurat": "081299990000",
            "faskes": "Puskesmas TEST",
        }
        r = requests.put(f"{API}/pasien/profil", json=payload, headers=pasien_headers)
        assert r.status_code == 200
        me = requests.get(f"{API}/pasien/me", headers=pasien_headers).json()["pasien"]
        assert me.get("golongan_darah") == "O+"
        assert me.get("profil_lengkap") is True


# ---------- PEMANTAUAN HARIAN ----------
class TestPemantauan:
    def test_submit_normal(self, pasien_headers):
        payload = {"kondisi": "Sehat"}
        r = requests.post(f"{API}/pasien/pemantauan", json=payload, headers=pasien_headers)
        assert r.status_code == 200
        assert r.json()["tanda_bahaya"] == []

    def test_detect_danger(self, pasien_headers):
        payload = {"kondisi": "Kurang baik", "perdarahan": "Ya", "sakit_kepala": "Ya"}
        r = requests.post(f"{API}/pasien/pemantauan", json=payload, headers=pasien_headers)
        assert r.status_code == 200
        bahaya = r.json()["tanda_bahaya"]
        assert any("Perdarahan" in b for b in bahaya)
        assert any("Sakit kepala" in b for b in bahaya)

    def test_get_pemantauan(self, pasien_headers):
        r = requests.get(f"{API}/pasien/pemantauan", headers=pasien_headers)
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list) and len(docs) >= 1


# ---------- MINGGUAN ----------
class TestMingguan:
    def test_submit(self, pasien_headers):
        r = requests.post(f"{API}/pasien/mingguan", json={"minggu_ke": 28, "jawaban": {"a": False, "b": True}}, headers=pasien_headers)
        assert r.status_code == 200
        assert r.json()["ada_bahaya"] is True

    def test_get(self, pasien_headers):
        r = requests.get(f"{API}/pasien/mingguan", headers=pasien_headers)
        assert r.status_code == 200
        assert any(d["minggu_ke"] == 28 for d in r.json())


# ---------- TTD ----------
class TestTtd:
    def test_sudah(self, pasien_headers):
        r = requests.post(f"{API}/pasien/ttd", json={"status": "sudah"}, headers=pasien_headers)
        assert r.status_code == 200

    def test_tidak_with_alasan(self, pasien_headers):
        r = requests.post(f"{API}/pasien/ttd", json={"status": "tidak", "alasan": "Lupa", "tanggal": "2026-01-05"}, headers=pasien_headers)
        assert r.status_code == 200

    def test_invalid_status(self, pasien_headers):
        r = requests.post(f"{API}/pasien/ttd", json={"status": "maybe"}, headers=pasien_headers)
        assert r.status_code == 400

    def test_get_ttd(self, pasien_headers):
        r = requests.get(f"{API}/pasien/ttd", headers=pasien_headers)
        assert r.status_code == 200
        assert len(r.json()) >= 2


# ---------- GERAKAN ($inc) ----------
class TestGerakan:
    def test_increment(self, pasien_headers):
        r1 = requests.post(f"{API}/pasien/gerakan", headers=pasien_headers)
        assert r1.status_code == 200
        n1 = r1.json()["jumlah"]
        r2 = requests.post(f"{API}/pasien/gerakan", headers=pasien_headers)
        assert r2.json()["jumlah"] == n1 + 1

    def test_get(self, pasien_headers):
        r = requests.get(f"{API}/pasien/gerakan", headers=pasien_headers)
        assert r.status_code == 200
        assert len(r.json()) >= 1


# ---------- PERSIAPAN & PENGINGAT ----------
class TestPersiapanPengingat:
    def test_persiapan_persist(self, pasien_headers):
        items = {"baju_bayi": True, "kartu_bpjs": False}
        r = requests.put(f"{API}/pasien/persiapan", json={"items": items}, headers=pasien_headers)
        assert r.status_code == 200
        g = requests.get(f"{API}/pasien/persiapan", headers=pasien_headers).json()
        assert g["items"]["baju_bayi"] is True

    def test_pengingat_persist(self, pasien_headers):
        items = {"ttd": False, "harian": True, "gerakan": True, "kontrol": False, "edukasi": True}
        r = requests.put(f"{API}/pasien/pengingat", json={"items": items}, headers=pasien_headers)
        assert r.status_code == 200
        g = requests.get(f"{API}/pasien/pengingat", headers=pasien_headers).json()
        assert g["ttd"] is False and g["kontrol"] is False


# ---------- EDUKASI SYNC ----------
class TestEdukasiSync:
    def test_edukasi_sync_klinik_to_pasien(self, admin_headers, pasien_headers):
        # Get fase from pasien
        fase_data = requests.get(f"{API}/pasien/edukasi-klinik", headers=pasien_headers).json()
        fase = fase_data["fase"]
        before = len(fase_data["pesan"])
        # Klinik posts an edukasi message to that fase
        marker = f"TEST_portal_edu_{date.today().isoformat()}"
        r = requests.post(f"{API}/edukasi/{fase}", json={"isi": marker}, headers=admin_headers)
        assert r.status_code == 200, r.text
        msg_id = r.json()["id"]
        # Pasien sees it
        after = requests.get(f"{API}/pasien/edukasi-klinik", headers=pasien_headers).json()
        assert len(after["pesan"]) == before + 1
        assert any(m["isi"] == marker for m in after["pesan"])
        # Cleanup edukasi
        requests.delete(f"{API}/edukasi/{msg_id}", headers=admin_headers)


# ---------- CLEANUP ----------
@pytest.fixture(scope="module", autouse=True)
def _cleanup_all(admin_headers, request):
    yield
    # Teardown — delete any TEST_portal_* patients (and their cascaded data in server-side delete)
    try:
        pts = requests.get(f"{API}/patients", headers=admin_headers).json()
        for p in pts:
            if (p.get("nama") or "").startswith("TEST_portal_"):
                requests.delete(f"{API}/patients/{p['id']}", headers=admin_headers)
    except Exception as e:
        print("cleanup error:", e)



# ---------- TTV PORTAL ----------
class TestTTVPortal:
    def test_ttv_reflects_checkup(self, admin_headers, pasien_headers, test_patient):
        r = requests.post(f"{API}/patients/{test_patient}/checkups", json={
            "patient_id": test_patient, "tanggal": date.today().isoformat(), "jenis": "anc", "ke": 3,
            "sistolik": 150, "diastolik": 95, "suhu": 36.8, "spo2": 98, "nadi": 88, "rr": 18, "lila": 24.5,
        }, headers=admin_headers)
        assert r.status_code == 200, r.text
        rows = requests.get(f"{API}/pasien/ttv", headers=pasien_headers).json()
        assert isinstance(rows, list) and len(rows) >= 1
        row = rows[0]
        assert row["sistolik"] == 150 and row["diastolik"] == 95 and row["ke"] == 3
        assert row["suhu"] == 36.8 and row["spo2"] == 98

    def test_ttv_requires_auth(self):
        r = requests.get(f"{API}/pasien/ttv")
        assert r.status_code in (401, 403)
