"""Iteration 9 tests: No. RM field, TTV fields (SpO2/suhu/nadi/RR/LiLa/TB), Imunisasi TT schedule."""
import os
import uuid
from datetime import date, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

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
    hpht = (date.today() - timedelta(weeks=20)).isoformat()
    r = client.post(f"{BASE_URL}/api/patients", json={
        "nama": f"TEST_iter9_{uuid.uuid4().hex[:6]}",
        "no_rm": "RM-0001",
        "no_wa": "081234567890",
        "hpht": hpht,
        "gravida": 1, "para": 0, "abortus": 0,
    }, timeout=30)
    assert r.status_code == 200, r.text
    p = r.json()
    yield p
    client.delete(f"{BASE_URL}/api/patients/{p['id']}", timeout=30)


# ---- No. RM ----
class TestNoRM:
    def test_create_with_no_rm(self, client, test_patient):
        assert test_patient.get("no_rm") == "RM-0001"

    def test_get_returns_no_rm(self, client, test_patient):
        r = client.get(f"{BASE_URL}/api/patients/{test_patient['id']}", timeout=30)
        assert r.status_code == 200
        assert r.json()["pasien"].get("no_rm") == "RM-0001"

    def test_update_no_rm(self, client, test_patient):
        r = client.put(f"{BASE_URL}/api/patients/{test_patient['id']}", json={
            "nama": test_patient["nama"],
            "no_rm": "RM-9999",
            "no_wa": test_patient["no_wa"],
            "hpht": test_patient["hpht"],
            "gravida": 1, "para": 0, "abortus": 0,
        }, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("no_rm") == "RM-9999"
        # persistence
        r2 = client.get(f"{BASE_URL}/api/patients/{test_patient['id']}", timeout=30)
        assert r2.json()["pasien"].get("no_rm") == "RM-9999"

    def test_no_rm_optional(self, client):
        r = client.post(f"{BASE_URL}/api/patients", json={
            "nama": f"TEST_norm_{uuid.uuid4().hex[:6]}",
            "no_wa": "081200000000",
            "hpht": (date.today() - timedelta(weeks=10)).isoformat(),
        }, timeout=30)
        assert r.status_code == 200
        p = r.json()
        assert p.get("no_rm", "") == ""
        client.delete(f"{BASE_URL}/api/patients/{p['id']}", timeout=30)


# ---- TTV di checkup ----
class TestCheckupTTV:
    def test_post_and_get_ttv(self, client, test_patient):
        pid = test_patient["id"]
        r = client.post(f"{BASE_URL}/api/patients/{pid}/checkups", json={
            "jenis": "anc", "ke": 1, "tanggal": date.today().isoformat(),
            "sistolik": 120, "diastolik": 80,
            "spo2": 98, "suhu": 36.6, "nadi": 82, "rr": 19, "lila": 26.5, "tinggi_badan": 155,
        }, timeout=30)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["spo2"] == 98
        assert doc["suhu"] == 36.6
        assert doc["nadi"] == 82
        assert doc["rr"] == 19
        assert doc["lila"] == 26.5
        assert doc["tinggi_badan"] == 155

        # GET returns them
        r2 = client.get(f"{BASE_URL}/api/patients/{pid}", timeout=30)
        checks = r2.json()["checkups"]
        assert len(checks) >= 1
        c = [c for c in checks if c["id"] == doc["id"]][0]
        assert c["spo2"] == 98 and c["suhu"] == 36.6 and c["nadi"] == 82
        assert c["rr"] == 19 and c["lila"] == 26.5 and c["tinggi_badan"] == 155

    def test_ttv_optional(self, client, test_patient):
        pid = test_patient["id"]
        # Add another checkup without TTV
        r = client.post(f"{BASE_URL}/api/patients/{pid}/checkups", json={
            "jenis": "anc", "ke": 2, "tanggal": date.today().isoformat(),
            "sistolik": 110, "diastolik": 70,
        }, timeout=30)
        assert r.status_code == 200
        doc = r.json()
        assert doc["spo2"] is None
        assert doc["lila"] is None


# ---- Imunisasi TT ----
@pytest.fixture(scope="class")
def tt_patient(client):
    hpht = (date.today() - timedelta(weeks=20)).isoformat()
    r = client.post(f"{BASE_URL}/api/patients", json={
        "nama": f"TEST_iter9tt_{uuid.uuid4().hex[:6]}",
        "no_wa": "081234567890",
        "hpht": hpht,
        "gravida": 1, "para": 0, "abortus": 0,
    }, timeout=30)
    assert r.status_code == 200
    p = r.json()
    yield p
    client.delete(f"{BASE_URL}/api/patients/{p['id']}", timeout=30)


class TestImunisasiTT:
    def test_initial_state(self, client, tt_patient):
        pid = tt_patient["id"]
        r = client.get(f"{BASE_URL}/api/patients/{pid}/imunisasi-tt", timeout=30)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == 5
        codes = [i["kode"] for i in items]
        assert codes == ["tt1", "tt2", "tt3", "tt4", "tt5"]
        # tt1 should have target = registration date, tt2..5 status=menunggu
        assert items[0]["tanggal_target"] is not None
        for i in items[1:]:
            assert i["status"] == "menunggu"
            assert i["tanggal_target"] is None

    def test_mark_tt1_done_updates_tt2_target(self, client, tt_patient):
        pid = tt_patient["id"]
        tt1_date = date.today().isoformat()
        r = client.post(f"{BASE_URL}/api/patients/{pid}/imunisasi-tt", json={
            "kode": "tt1", "tanggal": tt1_date,
        }, timeout=30)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["kode"] == "tt1"
        assert rec["tanggal"] == tt1_date

        # Verify tt2 gets target = tt1 + 28 days
        r2 = client.get(f"{BASE_URL}/api/patients/{pid}/imunisasi-tt", timeout=30)
        items = r2.json()["items"]
        tt1 = [i for i in items if i["kode"] == "tt1"][0]
        tt2 = [i for i in items if i["kode"] == "tt2"][0]
        assert tt1["status"] == "selesai"
        expected_tt2 = (date.fromisoformat(tt1_date) + timedelta(days=28)).isoformat()
        assert tt2["tanggal_target"] == expected_tt2
        assert tt2["status"] != "menunggu"

    def test_duplicate_tt1_rejected(self, client, tt_patient):
        pid = tt_patient["id"]
        r = client.post(f"{BASE_URL}/api/patients/{pid}/imunisasi-tt", json={
            "kode": "tt1", "tanggal": date.today().isoformat(),
        }, timeout=30)
        assert r.status_code == 400
        assert "sudah" in r.json()["detail"].lower()

    def test_delete_tt1_reverts_tt2(self, client, tt_patient):
        pid = tt_patient["id"]
        # Get tt1 record id
        r = client.get(f"{BASE_URL}/api/patients/{pid}/imunisasi-tt", timeout=30)
        items = r.json()["items"]
        tt1 = [i for i in items if i["kode"] == "tt1"][0]
        assert tt1["record"] is not None
        rec_id = tt1["record"]["id"]

        d = client.delete(f"{BASE_URL}/api/imunisasi-tt/{rec_id}", timeout=30)
        assert d.status_code == 200

        r2 = client.get(f"{BASE_URL}/api/patients/{pid}/imunisasi-tt", timeout=30)
        items2 = r2.json()["items"]
        tt2 = [i for i in items2 if i["kode"] == "tt2"][0]
        assert tt2["status"] == "menunggu"
        assert tt2["tanggal_target"] is None

    def test_delete_nonexistent(self, client):
        r = client.delete(f"{BASE_URL}/api/imunisasi-tt/nonexistent-id", timeout=30)
        assert r.status_code == 404

    def test_invalid_kode(self, client, tt_patient):
        pid = tt_patient["id"]
        r = client.post(f"{BASE_URL}/api/patients/{pid}/imunisasi-tt", json={
            "kode": "tt99",
        }, timeout=30)
        assert r.status_code == 400

    def test_future_date_rejected(self, client, tt_patient):
        pid = tt_patient["id"]
        future = (date.today() + timedelta(days=10)).isoformat()
        r = client.post(f"{BASE_URL}/api/patients/{pid}/imunisasi-tt", json={
            "kode": "tt1", "tanggal": future,
        }, timeout=30)
        assert r.status_code == 400
