"""Iteration 7 tests: checkup 'ke' field, /api/laporan, /api/templates shared collection."""
import os
import uuid
from datetime import date, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

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


frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
BASE_URL = base_url.rstrip("/")


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture
def test_patient(client):
    """Create a TEST_ patient with HPHT 40 weeks ago so all ANC weeks are eligible."""
    hpht = (date.today() - timedelta(weeks=40)).isoformat()
    r = client.post(f"{BASE_URL}/api/patients", json={
        "nama": f"TEST_iter7_{uuid.uuid4().hex[:6]}",
        "no_wa": "081234567890",
        "hpht": hpht,
        "gravida": 1, "para": 0, "abortus": 0,
    }, timeout=30)
    assert r.status_code == 200, r.text
    p = r.json()
    yield p
    client.delete(f"{BASE_URL}/api/patients/{p['id']}", timeout=30)


# ---- Checkup 'ke' validation ----

class TestCheckupKe:
    def test_save_k3_directly(self, client, test_patient):
        pid = test_patient["id"]
        r = client.post(f"{BASE_URL}/api/patients/{pid}/checkups", json={
            "jenis": "anc", "ke": 3, "tanggal": date.today().isoformat(),
        })
        assert r.status_code == 200, r.text
        assert r.json()["ke"] == 3

        # Verify GET patient reflects K3 done and next = K1
        g = client.get(f"{BASE_URL}/api/patients/{pid}").json()
        timeline = g["timeline"]["items"]
        k3_item = next(i for i in timeline if i["kode"] == "K3")
        k1_item = next(i for i in timeline if i["kode"] == "K1")
        assert k3_item["selesai"] is True
        assert k1_item["selesai"] is False
        assert g["pasien"]["kunjungan_berikutnya"] == "K1"

    def test_duplicate_k3_rejected(self, client, test_patient):
        pid = test_patient["id"]
        client.post(f"{BASE_URL}/api/patients/{pid}/checkups", json={"jenis": "anc", "ke": 3})
        r = client.post(f"{BASE_URL}/api/patients/{pid}/checkups", json={"jenis": "anc", "ke": 3})
        assert r.status_code == 400
        assert "K3" in r.json()["detail"]

    def test_out_of_range_ke(self, client, test_patient):
        pid = test_patient["id"]
        r = client.post(f"{BASE_URL}/api/patients/{pid}/checkups", json={"jenis": "anc", "ke": 7})
        assert r.status_code == 400

    def test_kf_ke_range(self, client, test_patient):
        pid = test_patient["id"]
        r = client.post(f"{BASE_URL}/api/patients/{pid}/checkups", json={"jenis": "kf", "ke": 5})
        assert r.status_code == 400


# ---- /api/laporan ----

class TestLaporan:
    def test_laporan_schema(self, client):
        r = client.get(f"{BASE_URL}/api/laporan")
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "tuntas", "tuntas_persen", "lost", "lost_persen", "anc", "pnc", "penyakit", "penyulit"):
            assert k in d, f"missing {k}"
        assert len(d["anc"]) == 6
        assert len(d["pnc"]) == 4
        for i, item in enumerate(d["anc"], start=1):
            assert item["kode"] == f"K{i}"
            assert "eligible" in item and "done" in item and "persen" in item and "label" in item
        for i, item in enumerate(d["pnc"], start=1):
            assert item["kode"] == f"KF{i}"
        assert isinstance(d["penyakit"], list)
        assert isinstance(d["penyulit"], list)

    def test_laporan_reflects_new_checkup(self, client, test_patient):
        pid = test_patient["id"]
        before = client.get(f"{BASE_URL}/api/laporan").json()
        before_k1 = next(a for a in before["anc"] if a["kode"] == "K1")
        before_done_k1 = before_k1["done"]
        client.post(f"{BASE_URL}/api/patients/{pid}/checkups", json={"jenis": "anc", "ke": 1})
        after = client.get(f"{BASE_URL}/api/laporan").json()
        after_k1 = next(a for a in after["anc"] if a["kode"] == "K1")
        # >= karena worker paralel lain bisa ikut menambah K1 di antara before/after
        assert after_k1["done"] >= before_done_k1 + 1


# ---- /api/templates (shared collection) ----

class TestTemplates:
    def test_crud_and_shared(self, client):
        judul = f"TEST_iter7_tpl_{uuid.uuid4().hex[:6]}"
        r = client.post(f"{BASE_URL}/api/templates", json={"judul": judul, "isi": "Halo {nama}, jadwal {jadwal}"})
        assert r.status_code == 200, r.text
        tpl = r.json()
        tid = tpl["id"]

        # GET list contains it
        lst = client.get(f"{BASE_URL}/api/templates").json()
        assert any(t["id"] == tid for t in lst)

        # Duplicate rejected
        r2 = client.post(f"{BASE_URL}/api/templates", json={"judul": judul, "isi": "x"})
        assert r2.status_code == 400

        # Empty rejected
        r3 = client.post(f"{BASE_URL}/api/templates", json={"judul": "", "isi": ""})
        assert r3.status_code == 400

        # Delete
        rd = client.delete(f"{BASE_URL}/api/templates/{tid}")
        assert rd.status_code == 200
        lst2 = client.get(f"{BASE_URL}/api/templates").json()
        assert not any(t["id"] == tid for t in lst2)

    def test_delete_not_found(self, client):
        r = client.delete(f"{BASE_URL}/api/templates/nonexistent-xyz")
        assert r.status_code == 404
