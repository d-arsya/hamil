"""Iteration 5 backend tests: riwayat kehamilan, timeline, imunisasi, delivery extended, RTL, indicators."""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

# --- SEC-001: read admin password from /app/memory/test_credentials.md ---
import re as _re_pw
from pathlib import Path as _Path_pw
def _read_admin_password():
    _p = _Path_pw("/app/memory/test_credentials.md")
    if _p.exists():
        _m = _re_pw.search(r"Password:\s*`([^`]+)`", _p.read_text())
        if _m: return _m.group(1)
    return "admin123"
ADMIN_PASSWORD = _read_admin_password()


BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def h(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def hamil_patient(h):
    """Fresh pregnancy patient (HPHT 120 days ago -> trimester_2)."""
    hpht = (date.today() - timedelta(days=120)).isoformat()
    payload = {
        "nama": f"TEST_ITER5_{uuid.uuid4().hex[:6]}",
        "no_wa": "08123456789",
        "hpht": hpht,
        "gravida": 3, "para": 1, "abortus": 1,
        "riwayat_kehamilan": [
            {"tahun": "2018", "tempat": "PMB Bidan", "penolong": "Bidan", "hasil": "Lahir hidup", "penyulit": "Preeklamsia"},
            {"tahun": "2020", "tempat": "RS", "penolong": "Dokter", "hasil": "Abortus", "penyulit": ""},
        ],
    }
    r = requests.post(f"{API}/patients", json=payload, headers=h, timeout=30)
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    yield r.json()
    requests.delete(f"{API}/patients/{pid}", headers=h, timeout=30)


@pytest.fixture
def nifas_patient(h):
    """Patient with delivery 10 days ago and named baby."""
    hpht = (date.today() - timedelta(days=290)).isoformat()
    r = requests.post(f"{API}/patients", json={
        "nama": f"TEST_ITER5N_{uuid.uuid4().hex[:6]}",
        "no_wa": "08123456700",
        "hpht": hpht,
    }, headers=h, timeout=30)
    assert r.status_code == 200
    pid = r.json()["id"]
    tp = (date.today() - timedelta(days=10)).isoformat()
    r2 = requests.put(f"{API}/patients/{pid}/persalinan", json={
        "tanggal_persalinan": tp,
        "nama_anak": "Bima",
        "jenis_kelamin_anak": "Laki-laki",
        "cara_lahir": "Normal",
        "tempat_lahir": "PMB",
        "penolong_persalinan": "Bidan",
        "masalah_persalinan": "",
    }, headers=h, timeout=30)
    assert r2.status_code == 200, r2.text
    yield r2.json()
    requests.delete(f"{API}/patients/{pid}", headers=h, timeout=30)


# ---------- Riwayat kehamilan ----------
class TestRiwayatKehamilan:
    def test_create_and_persist(self, h, hamil_patient):
        pid = hamil_patient["id"]
        r = requests.get(f"{API}/patients/{pid}", headers=h, timeout=30)
        assert r.status_code == 200
        rk = r.json()["pasien"]["riwayat_kehamilan"]
        assert len(rk) == 2
        assert rk[0]["penyulit"] == "Preeklamsia"
        assert rk[1]["hasil"] == "Abortus"

    def test_indicator_fields_present(self, h, hamil_patient):
        p = hamil_patient
        # New fields required by frontend
        for k in ("selisih_hari", "kontrol_fase_ke", "kontrol_fase_total",
                  "anc_lengkap", "rtl_berikutnya", "imunisasi_berikutnya",
                  "nama_anak", "riwayat_kehamilan"):
            assert k in p, f"missing field {k}"
        assert p["fase"] == "trimester_2"
        assert p["kontrol_fase_total"] == 1  # T2 = 1 kunjungan (K3)
        assert p["anc_lengkap"] is False
        assert p["imunisasi_berikutnya"] is None


# ---------- Timeline ----------
class TestTimeline:
    def test_timeline_structure_hamil(self, h, hamil_patient):
        pid = hamil_patient["id"]
        r = requests.get(f"{API}/patients/{pid}", headers=h, timeout=30)
        tl = r.json()["timeline"]
        assert "items" in tl and "ringkasan" in tl
        codes = [i["kode"] for i in tl["items"]]
        assert codes == ["K1", "K2", "K3", "K4", "K5", "K6"]
        for phase in ("trimester_1", "trimester_2", "trimester_3"):
            assert phase in tl["ringkasan"]
        assert tl["ringkasan"]["trimester_1"]["total"] == 2
        assert tl["ringkasan"]["trimester_2"]["total"] == 1
        assert tl["ringkasan"]["trimester_3"]["total"] == 3

    def test_timeline_has_kf_after_delivery(self, h, nifas_patient):
        pid = nifas_patient["id"]
        r = requests.get(f"{API}/patients/{pid}", headers=h, timeout=30)
        tl = r.json()["timeline"]
        codes = [i["kode"] for i in tl["items"] if i["fase"] == "nifas"]
        assert codes == ["KF1", "KF2", "KF3", "KF4"]
        assert tl["ringkasan"]["nifas"]["total"] == 4


# ---------- Delivery extended ----------
class TestDeliveryExtended:
    def test_delivery_baby_fields_persist(self, h, nifas_patient):
        p = nifas_patient
        assert p["nama_anak"] == "Bima"
        assert p["jenis_kelamin_anak"] == "Laki-laki"
        assert p["cara_lahir"] == "Normal"
        assert p["fase"] == "nifas"


# ---------- Imunisasi ----------
class TestImunisasi:
    def test_get_schedule_11_items(self, h, nifas_patient):
        pid = nifas_patient["id"]
        r = requests.get(f"{API}/patients/{pid}/imunisasi", headers=h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["usia_bayi_hari"] == 10
        assert len(data["items"]) == 11
        kodes = [i["kode"] for i in data["items"]]
        assert kodes == ["hb0", "bcg_polio0", "polio1", "bln2", "bln3", "bln4",
                         "bln6", "mr1", "bln12", "mr2", "bln18"]
        # each has status
        for it in data["items"]:
            assert it["status"] in ("selesai", "terlambat", "hari_ini", "mendekati", "terjadwal")

    def test_get_no_delivery_empty(self, h, hamil_patient):
        pid = hamil_patient["id"]
        r = requests.get(f"{API}/patients/{pid}/imunisasi", headers=h, timeout=30)
        assert r.status_code == 200
        assert r.json() == {"usia_bayi_hari": None, "items": []}

    def test_post_before_delivery_fails(self, h, hamil_patient):
        pid = hamil_patient["id"]
        r = requests.post(f"{API}/patients/{pid}/imunisasi", json={"kode": "hb0"}, headers=h, timeout=30)
        assert r.status_code == 400
        assert "persalinan" in r.json()["detail"].lower()

    def test_post_invalid_kode(self, h, nifas_patient):
        pid = nifas_patient["id"]
        r = requests.post(f"{API}/patients/{pid}/imunisasi", json={"kode": "xyz"}, headers=h, timeout=30)
        assert r.status_code == 400

    def test_post_and_duplicate(self, h, nifas_patient):
        pid = nifas_patient["id"]
        r = requests.post(f"{API}/patients/{pid}/imunisasi", json={"kode": "hb0"}, headers=h, timeout=30)
        assert r.status_code == 200, r.text
        rec_id = r.json()["id"]
        # duplicate
        r2 = requests.post(f"{API}/patients/{pid}/imunisasi", json={"kode": "hb0"}, headers=h, timeout=30)
        assert r2.status_code == 400
        assert "sudah" in r2.json()["detail"].lower()
        # verify status via GET
        rg = requests.get(f"{API}/patients/{pid}/imunisasi", headers=h, timeout=30)
        hb0 = next(i for i in rg.json()["items"] if i["kode"] == "hb0")
        assert hb0["status"] == "selesai"
        assert hb0["record"] is not None
        # imunisasi_berikutnya should be next one (bcg_polio0)
        p = requests.get(f"{API}/patients/{pid}", headers=h, timeout=30).json()["pasien"]
        assert p["imunisasi_berikutnya"] is not None
        assert p["imunisasi_berikutnya"]["kode"] == "bcg_polio0"
        # delete
        rd = requests.delete(f"{API}/imunisasi/{rec_id}", headers=h, timeout=30)
        assert rd.status_code == 200
        rg2 = requests.get(f"{API}/patients/{pid}/imunisasi", headers=h, timeout=30)
        hb0_after = next(i for i in rg2.json()["items"] if i["kode"] == "hb0")
        assert hb0_after["status"] != "selesai"

    def test_delete_nonexistent(self, h):
        r = requests.delete(f"{API}/imunisasi/does-not-exist", headers=h, timeout=30)
        assert r.status_code == 404


# ---------- Checkup extended (RTL, KB, imunisasi_diberikan) ----------
class TestCheckupExtended:
    def test_checkup_with_rtl_hamil(self, h, hamil_patient):
        pid = hamil_patient["id"]
        r = requests.post(f"{API}/patients/{pid}/checkups", json={
            "sistolik": 110, "diastolik": 70,
            "rencana_tindak_lanjut": "Kontrol 2 minggu lagi + USG",
        }, headers=h, timeout=30)
        assert r.status_code == 200
        assert r.json()["rencana_tindak_lanjut"] == "Kontrol 2 minggu lagi + USG"
        p = requests.get(f"{API}/patients/{pid}", headers=h, timeout=30).json()["pasien"]
        assert p["rtl_berikutnya"] == "Kontrol 2 minggu lagi + USG"

    def test_checkup_nifas_kb_imunisasi_fields(self, h, nifas_patient):
        pid = nifas_patient["id"]
        r = requests.post(f"{API}/patients/{pid}/checkups", json={
            "jenis_kb": "IUD",
            "kontrol_kb": True,
            "imunisasi_diberikan": "HB-0",
            "rencana_tindak_lanjut": "KF berikutnya di hari 14",
        }, headers=h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["jenis_kb"] == "IUD"
        assert d["kontrol_kb"] is True
        assert d["imunisasi_diberikan"] == "HB-0"
        assert d["jenis"] == "kf"


# ---------- ANC lengkap flag ----------
class TestAncLengkap:
    def test_anc_lengkap_after_6(self, h):
        hpht = (date.today() - timedelta(days=270)).isoformat()
        r = requests.post(f"{API}/patients", json={
            "nama": f"TEST_ITER5_A_{uuid.uuid4().hex[:6]}",
            "no_wa": "08111", "hpht": hpht,
        }, headers=h, timeout=30)
        pid = r.json()["id"]
        try:
            for i in range(6):
                d = (date.today() - timedelta(days=200 - i * 20)).isoformat()
                rc = requests.post(f"{API}/patients/{pid}/checkups", json={"tanggal": d}, headers=h, timeout=30)
                assert rc.status_code == 200
            p = requests.get(f"{API}/patients/{pid}", headers=h, timeout=30).json()["pasien"]
            assert p["anc_lengkap"] is True
            assert p["kupon_eligible"] is True
        finally:
            requests.delete(f"{API}/patients/{pid}", headers=h, timeout=30)
