"""Iteration 6 backend tests: penyulit options, WA templates CRUD, checkup jenis override, delivery edit."""
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
def h():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


# ---------- Options penyulit ----------
class TestPenyulitOptions:
    def test_get_penyulit_returns_custom_list(self, h):
        r = requests.get(f"{API}/options/penyulit", headers=h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "custom" in data
        assert isinstance(data["custom"], list)

    def test_penyulit_custom_appears_after_patient_created(self, h):
        marker = f"TEST_ITER6_PENYULIT_{uuid.uuid4().hex[:6]}"
        hpht = (date.today() - timedelta(days=60)).isoformat()
        r = requests.post(f"{API}/patients", json={
            "nama": f"TEST_ITER6_{uuid.uuid4().hex[:6]}",
            "no_wa": "08123",
            "hpht": hpht,
            "riwayat_kehamilan": [
                {"tahun": "2020", "hasil": "Lahir hidup", "penyulit": marker, "cara_lahir": "Normal - Vakum/Forceps"}
            ],
        }, headers=h, timeout=30)
        assert r.status_code == 200
        pid = r.json()["id"]
        try:
            r2 = requests.get(f"{API}/options/penyulit", headers=h, timeout=30)
            assert marker in r2.json()["custom"], f"marker {marker} not found in {r2.json()['custom']}"
            # default excluded
            for default in ["Preeklamsia", "Tidak ada", "Lainnya"]:
                assert default not in r2.json()["custom"]
        finally:
            requests.delete(f"{API}/patients/{pid}", headers=h, timeout=30)
        # After deletion, marker should be gone
        r3 = requests.get(f"{API}/options/penyulit", headers=h, timeout=30)
        assert marker not in r3.json()["custom"]

    def test_cara_lahir_persists_in_riwayat(self, h):
        hpht = (date.today() - timedelta(days=60)).isoformat()
        r = requests.post(f"{API}/patients", json={
            "nama": f"TEST_ITER6_CL_{uuid.uuid4().hex[:6]}",
            "no_wa": "08000",
            "hpht": hpht,
            "riwayat_kehamilan": [
                {"tahun": "2019", "hasil": "Lahir hidup", "cara_lahir": "Sesar (SC)", "penyulit": "Tidak ada"}
            ],
        }, headers=h, timeout=30)
        pid = r.json()["id"]
        try:
            g = requests.get(f"{API}/patients/{pid}", headers=h, timeout=30).json()
            rk = g["pasien"]["riwayat_kehamilan"]
            assert rk[0]["cara_lahir"] == "Sesar (SC)"
        finally:
            requests.delete(f"{API}/patients/{pid}", headers=h, timeout=30)


# ---------- Template CRUD ----------
class TestTemplateCRUD:
    def test_template_lifecycle(self, h):
        judul = f"TEST_ITER6_TPL_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/templates", json={"judul": judul, "isi": "Halo {nama}, jadwal {jadwal}"}, headers=h, timeout=30)
        assert r.status_code == 200, r.text
        tpl = r.json()
        assert tpl["judul"] == judul
        assert "{nama}" in tpl["isi"]
        assert "id" in tpl
        tid = tpl["id"]
        try:
            # list
            rl = requests.get(f"{API}/templates", headers=h, timeout=30)
            assert rl.status_code == 200
            ids = [t["id"] for t in rl.json()]
            assert tid in ids
        finally:
            rd = requests.delete(f"{API}/templates/{tid}", headers=h, timeout=30)
            assert rd.status_code == 200
        # 404 after delete
        rd2 = requests.delete(f"{API}/templates/{tid}", headers=h, timeout=30)
        assert rd2.status_code == 404

    def test_template_empty_validation(self, h):
        r = requests.post(f"{API}/templates", json={"judul": "  ", "isi": "abc"}, headers=h, timeout=30)
        assert r.status_code == 400
        r2 = requests.post(f"{API}/templates", json={"judul": "abc", "isi": "   "}, headers=h, timeout=30)
        assert r2.status_code == 400


# ---------- Checkup jenis override ----------
class TestCheckupJenisOverride:
    def test_hamil_patient_pnc_override(self, h):
        """Pasien hamil dengan override jenis=kf → checkup tersimpan sebagai kf, ANC status tidak berubah."""
        hpht = (date.today() - timedelta(days=120)).isoformat()
        r = requests.post(f"{API}/patients", json={
            "nama": f"TEST_ITER6_JN_{uuid.uuid4().hex[:6]}",
            "no_wa": "08222",
            "hpht": hpht,
        }, headers=h, timeout=30)
        pid = r.json()["id"]
        assert r.json()["fase"] != "nifas"
        anc_before = r.json()["jumlah_kontrol"]
        try:
            rc = requests.post(f"{API}/patients/{pid}/checkups", json={
                "jenis": "kf",
                "jenis_kb": "Pil KB",
                "imunisasi_diberikan": "HB-0",
            }, headers=h, timeout=30)
            assert rc.status_code == 200, rc.text
            assert rc.json()["jenis"] == "kf"
            # Verify via GET
            g = requests.get(f"{API}/patients/{pid}", headers=h, timeout=30).json()
            checkups = g["checkups"]
            assert any(c["jenis"] == "kf" for c in checkups)
            # ANC count unchanged (still hamil, checkup counted as kf)
            assert g["pasien"]["jumlah_kontrol"] == anc_before  # phase_checks counts anc only for hamil
            assert g["pasien"]["fase"] != "nifas"
        finally:
            requests.delete(f"{API}/patients/{pid}", headers=h, timeout=30)

    def test_default_jenis_by_phase(self, h):
        """Tanpa jenis override, default anc untuk hamil, kf untuk nifas."""
        hpht = (date.today() - timedelta(days=290)).isoformat()
        r = requests.post(f"{API}/patients", json={
            "nama": f"TEST_ITER6_DFL_{uuid.uuid4().hex[:6]}",
            "no_wa": "08333",
            "hpht": hpht,
        }, headers=h, timeout=30)
        pid = r.json()["id"]
        try:
            # Before delivery -> anc
            rc = requests.post(f"{API}/patients/{pid}/checkups", json={}, headers=h, timeout=30)
            assert rc.json()["jenis"] == "anc"
            # Mark delivery
            tp = (date.today() - timedelta(days=5)).isoformat()
            requests.put(f"{API}/patients/{pid}/persalinan", json={"tanggal_persalinan": tp}, headers=h, timeout=30)
            # After delivery -> kf
            rc2 = requests.post(f"{API}/patients/{pid}/checkups", json={}, headers=h, timeout=30)
            assert rc2.json()["jenis"] == "kf"
        finally:
            requests.delete(f"{API}/patients/{pid}", headers=h, timeout=30)


# ---------- Delivery edit ----------
class TestDeliveryEdit:
    def test_edit_delivery_updates_baby_name(self, h):
        hpht = (date.today() - timedelta(days=290)).isoformat()
        r = requests.post(f"{API}/patients", json={
            "nama": f"TEST_ITER6_ED_{uuid.uuid4().hex[:6]}",
            "no_wa": "08444",
            "hpht": hpht,
        }, headers=h, timeout=30)
        pid = r.json()["id"]
        try:
            tp = (date.today() - timedelta(days=10)).isoformat()
            r1 = requests.put(f"{API}/patients/{pid}/persalinan", json={
                "tanggal_persalinan": tp,
                "nama_anak": "Andi",
                "jenis_kelamin_anak": "Laki-laki",
                "cara_lahir": "Normal / Spontan",
            }, headers=h, timeout=30)
            assert r1.status_code == 200
            assert r1.json()["nama_anak"] == "Andi"
            # Edit
            r2 = requests.put(f"{API}/patients/{pid}/persalinan", json={
                "tanggal_persalinan": tp,
                "nama_anak": "Budi",
                "jenis_kelamin_anak": "Laki-laki",
                "cara_lahir": "Sectio Caesaria (SC)",
                "tempat_lahir": "RSUD",
                "penolong_persalinan": "dr. X",
                "masalah_persalinan": "-",
            }, headers=h, timeout=30)
            assert r2.status_code == 200
            g = requests.get(f"{API}/patients/{pid}", headers=h, timeout=30).json()["pasien"]
            assert g["nama_anak"] == "Budi"
            assert g["cara_lahir"] == "Sectio Caesaria (SC)"
            assert g["tempat_lahir"] == "RSUD"
        finally:
            requests.delete(f"{API}/patients/{pid}", headers=h, timeout=30)
