"""
Iterasi 17: nomor BPJS, field detail bayi ANC, pemeriksaan fisik bayi PNC,
ceklis kunjungan sebelumnya tanpa data, edit riwayat kontrol (PUT), resume PDF.
"""
import os
import pytest
import requests
from datetime import date

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "Bidan#Aman2026xY9"}, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def test_patient(admin_headers):
    r = requests.post(f"{API}/patients", json={
        "nama": "TEST_i17_Bidan", "no_wa": "081200007171", "hpht": (date.today().replace(day=1)).isoformat(),
        "alamat": "TEST i17", "no_rm": "RM-I17", "no_bpjs": "0001234567890",
    }, headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    yield pid
    requests.delete(f"{API}/patients/{pid}", headers=admin_headers, timeout=30)


class TestNoBpjs:
    def test_bpjs_tersimpan(self, admin_headers, test_patient):
        r = requests.get(f"{API}/patients/{test_patient}", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["pasien"]["no_bpjs"] == "0001234567890"

    def test_bpjs_opsional(self, admin_headers):
        r = requests.post(f"{API}/patients", json={
            "nama": "TEST_i17_NoBpjs", "no_wa": "081200007172", "hpht": date.today().isoformat(),
        }, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        detail = requests.get(f"{API}/patients/{pid}", headers=admin_headers, timeout=30).json()
        assert detail["pasien"]["no_bpjs"] == ""
        requests.delete(f"{API}/patients/{pid}", headers=admin_headers, timeout=30)


class TestCheckupFields:
    def test_anc_detail_bayi(self, admin_headers, test_patient):
        r = requests.post(f"{API}/patients/{test_patient}/checkups", json={
            "tanggal": date.today().isoformat(), "jenis": "anc", "ke": 1,
            "sistolik": 110, "diastolik": 70,
            "djj": 140, "letak_plasenta": "Posterior", "ketuban": "Cukup", "tbj": 250,
            "jumlah_janin": "Tunggal", "keadaan_janin": "Hidup", "lokasi_kehamilan": "Intrauterine",
            "presentasi": "Kepala", "jk_janin": "Belum diketahui",
        }, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        detail = requests.get(f"{API}/patients/{test_patient}", headers=admin_headers, timeout=30).json()
        c = next(x for x in detail["checkups"] if x["ke"] == 1)
        assert c["djj"] == 140 and c["letak_plasenta"] == "Posterior" and c["tbj"] == 250
        assert c["ketuban"] == "Cukup" and c["presentasi"] == "Kepala" and c["jumlah_janin"] == "Tunggal"

    def test_pnc_fisik_bayi(self, admin_headers, test_patient):
        r = requests.post(f"{API}/patients/{test_patient}/checkups", json={
            "tanggal": date.today().isoformat(), "jenis": "kf", "ke": 1,
            "bayi_bb": 3100, "bayi_pb": 49.0, "bayi_lk": 34.5, "bayi_suhu": 36.8,
            "bayi_tali_pusat": "Bersih & kering", "bayi_ikterus": "Tidak",
        }, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        detail = requests.get(f"{API}/patients/{test_patient}", headers=admin_headers, timeout=30).json()
        c = next(x for x in detail["checkups"] if x["jenis"] == "kf")
        assert c["bayi_bb"] == 3100 and c["bayi_pb"] == 49.0 and c["bayi_lk"] == 34.5
        assert c["bayi_tali_pusat"] == "Bersih & kering" and c["bayi_ikterus"] == "Tidak"

    def test_tandai_manual_tanpa_data(self, admin_headers, test_patient):
        # Ceklis kunjungan sebelumnya walaupun tanpa data pemeriksaan
        r = requests.post(f"{API}/patients/{test_patient}/checkups", json={
            "tanggal": date.today().isoformat(), "jenis": "anc", "ke": 2,
            "catatan": "Ditandai manual — tanpa data pemeriksaan",
        }, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        detail = requests.get(f"{API}/patients/{test_patient}", headers=admin_headers, timeout=30).json()
        k2 = next(x for x in detail["checkups"] if x["jenis"] == "anc" and x["ke"] == 2)
        assert k2["sistolik"] is None
        assert "Ditandai manual" in k2["catatan"]


class TestEditCheckup:
    def _buat_checkup(self, admin_headers, pid):
        r = requests.post(f"{API}/patients/{pid}/checkups", json={
            "tanggal": date.today().isoformat(), "jenis": "anc", "sistolik": 110, "diastolik": 70,
        }, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def test_edit_berhasil(self, admin_headers, test_patient):
        cid = self._buat_checkup(admin_headers, test_patient)
        r = requests.put(f"{API}/checkups/{cid}", json={
            "tanggal": date.today().isoformat(), "sistolik": 120, "diastolik": 80, "keluhan": "Mual pagi hari",
            "djj": 145, "presentasi": "Bokong",
        }, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        detail2 = requests.get(f"{API}/patients/{test_patient}", headers=admin_headers, timeout=30).json()
        c2 = next(x for x in detail2["checkups"] if x["id"] == cid)
        assert c2["sistolik"] == 120 and c2["keluhan"] == "Mual pagi hari"
        assert c2["djj"] == 145 and c2["presentasi"] == "Bokong"
        # jenis & ke tidak berubah
        assert c2["jenis"] == "anc" and c2["ke"] is not None

    def test_edit_tanggal_masa_depan_ditolak(self, admin_headers, test_patient):
        cid = self._buat_checkup(admin_headers, test_patient)
        r = requests.put(f"{API}/checkups/{cid}", json={"tanggal": "2999-01-01"}, headers=admin_headers, timeout=30)
        assert r.status_code == 400

    def test_edit_id_tidak_ada(self, admin_headers):
        r = requests.put(f"{API}/checkups/id-tidak-ada", json={"keluhan": "x"}, headers=admin_headers, timeout=30)
        assert r.status_code == 404

    def test_edit_requires_auth(self):
        r = requests.put(f"{API}/checkups/apapun", json={})
        assert r.status_code in (401, 403)
