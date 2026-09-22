"""Iteration 4: Focused tests for PUT /api/patients/{id}/persalinan validation
to confirm backend returns Indonesian error detail that the frontend can surface."""
import os
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


BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE}/api/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


@pytest.fixture
def patient(client):
    hpht = (date.today() - timedelta(days=90)).isoformat()
    payload = {
        "nama": "TEST_persalinan_val",
        "no_wa": "628111222333",
        "alamat": "TEST",
        "hpht": hpht,
        "gravida": 1, "para": 0, "abortus": 0,
    }
    r = client.post(f"{BASE}/api/patients", json=payload)
    assert r.status_code in (200, 201), r.text
    pid = r.json()["id"]
    yield {"id": pid, "hpht": hpht}
    client.delete(f"{BASE}/api/patients/{pid}")


def test_persalinan_future_date_400(client, patient):
    future = (date.today() + timedelta(days=5)).isoformat()
    r = client.put(f"{BASE}/api/patients/{patient['id']}/persalinan", json={"tanggal_persalinan": future})
    assert r.status_code == 400
    assert "masa depan" in r.json()["detail"].lower()


def test_persalinan_before_hpht_400(client, patient):
    before = (date.fromisoformat(patient["hpht"]) - timedelta(days=1)).isoformat()
    r = client.put(f"{BASE}/api/patients/{patient['id']}/persalinan", json={"tanggal_persalinan": before})
    assert r.status_code == 400
    assert "sebelum hpht" in r.json()["detail"].lower()


def test_persalinan_valid_moves_to_nifas(client, patient):
    valid = date.today().isoformat()
    r = client.put(f"{BASE}/api/patients/{patient['id']}/persalinan", json={"tanggal_persalinan": valid})
    assert r.status_code == 200, r.text
    # GET to verify persisted + fase
    g = client.get(f"{BASE}/api/patients/{patient['id']}")
    assert g.status_code == 200
    p = g.json()["pasien"]
    assert p["tanggal_persalinan"] == valid
    assert p["fase"] == "nifas"


def test_persalinan_null_resets(client, patient):
    # first set, then null
    valid = date.today().isoformat()
    client.put(f"{BASE}/api/patients/{patient['id']}/persalinan", json={"tanggal_persalinan": valid})
    r = client.put(f"{BASE}/api/patients/{patient['id']}/persalinan", json={"tanggal_persalinan": None})
    assert r.status_code == 200
    g = client.get(f"{BASE}/api/patients/{patient['id']}")
    assert g.json()["pasien"]["tanggal_persalinan"] is None
