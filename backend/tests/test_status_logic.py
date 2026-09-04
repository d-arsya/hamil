"""Status logic edge cases: nifas status contaminated by pre-delivery ANC checkups."""
import os
from datetime import date, timedelta

import pytest
import requests
from dotenv import dotenv_values

fe = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or fe["REACT_APP_BACKEND_URL"]).rstrip("/")


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": "admin123"}, timeout=30)
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(client, ids):
    yield
    for i in ids:
        client.delete(f"{BASE_URL}/api/patients/{i}", timeout=30)


def test_nifas_overdue_status_not_masked_by_anc_checkup(client, ids):
    """Patient had an ANC checkup, then delivered 5 days ago -> KF1 (delivery+2) is overdue.
    Expected status 'terlambat'; bug: ANC checkup date makes it 'sudah_kontrol'."""
    hpht = (date.today() - timedelta(weeks=39)).isoformat()
    pid = client.post(f"{BASE_URL}/api/patients",
                      json={"nama": "TEST_NifasStatus", "no_wa": "081000000011", "hpht": hpht},
                      timeout=30).json()["id"]
    ids.append(pid)
    # ANC checkup today
    client.post(f"{BASE_URL}/api/patients/{pid}/checkups",
                json={"tanggal": date.today().isoformat(), "sistolik": 110, "diastolik": 70}, timeout=30)
    deliv = (date.today() - timedelta(days=5)).isoformat()
    p = client.put(f"{BASE_URL}/api/patients/{pid}/persalinan",
                   json={"tanggal_persalinan": deliv}, timeout=30).json()
    assert p["fase"] == "nifas"
    assert p["kunjungan_berikutnya"] == "KF1"
    assert p["jadwal_berikutnya"] == (date.fromisoformat(deliv) + timedelta(days=2)).isoformat()
    assert p["status"] == "terlambat", (
        f"KF1 due {p['jadwal_berikutnya']} is in the past but status={p['status']} "
        "(ANC checkup wrongly counted as KF visit)")


def test_delivery_date_before_hpht_rejected(client, ids):
    """Delivery date earlier than HPHT is medically impossible; should be rejected."""
    hpht = date.today().isoformat()
    pid = client.post(f"{BASE_URL}/api/patients",
                      json={"nama": "TEST_BadDelivOrder", "no_wa": "081000000012", "hpht": hpht},
                      timeout=30).json()["id"]
    ids.append(pid)
    r = client.put(f"{BASE_URL}/api/patients/{pid}/persalinan",
                   json={"tanggal_persalinan": (date.today() - timedelta(days=300)).isoformat()}, timeout=30)
    assert r.status_code in (400, 422), f"accepted impossible delivery date (status {r.status_code})"


def test_future_hpht_rejected(client, ids):
    """HPHT in the future should be rejected."""
    r = client.post(f"{BASE_URL}/api/patients",
                    json={"nama": "TEST_FutureHpht", "no_wa": "081000000013",
                          "hpht": (date.today() + timedelta(days=60)).isoformat()}, timeout=30)
    if r.status_code == 200:
        ids.append(r.json()["id"])
    assert r.status_code in (400, 422), "future HPHT accepted"
