"""Iteration-2 regression tests: date/GPA validation 400s, lockout semantics, phase-filtered status.

NOTE: TestLockout clears db.login_attempts afterwards so the admin account is not left locked.
"""
import os
import subprocess
from datetime import date, timedelta

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


fe = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or fe["REACT_APP_BACKEND_URL"]).rstrip("/")
CREDS = {"username": "admin", "password": ADMIN_PASSWORD}


def clear_login_attempts():
    subprocess.run(
        ["mongosh", os.environ.get("DB_NAME", "test_database"), "--quiet",
         "--eval", "db.login_attempts.deleteMany({})"],
        capture_output=True, check=False,
    )


@pytest.fixture(scope="module")
def client():
    clear_login_attempts()
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json=CREDS, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
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


def mkpatient(client, ids, **over):
    body = {"nama": "TEST_Reg2", "no_wa": "081000000099",
            "hpht": (date.today() - timedelta(weeks=20)).isoformat()}
    body.update(over)
    r = client.post(f"{BASE_URL}/api/patients", json=body, timeout=30)
    if r.status_code == 200:
        ids.append(r.json()["id"])
    return r


# ---------- validation: 400 not 500 ----------
class TestValidation:
    def test_malformed_hpht_400(self, client, ids):
        r = mkpatient(client, ids, hpht="bukan-tanggal")
        assert r.status_code == 400, r.text
        assert "HPHT" in r.json()["detail"]

    def test_future_hpht_400(self, client, ids):
        r = mkpatient(client, ids, hpht=(date.today() + timedelta(days=5)).isoformat())
        assert r.status_code == 400, r.text

    def test_negative_gravida_400(self, client, ids):
        r = mkpatient(client, ids, gravida=-2)
        assert r.status_code == 400, r.text
        r2 = mkpatient(client, ids, para=-1)
        assert r2.status_code == 400, r2.text
        r3 = mkpatient(client, ids, gravida=0)
        assert r3.status_code == 400, r3.text

    def test_update_patient_invalid_date_400(self, client, ids):
        r = mkpatient(client, ids)
        pid = r.json()["id"]
        u = client.put(f"{BASE_URL}/api/patients/{pid}",
                       json={"nama": "TEST_Reg2", "no_wa": "081000000099", "hpht": "31-12-2026"}, timeout=30)
        assert u.status_code == 400, u.text

    def test_future_checkup_date_400(self, client, ids):
        pid = mkpatient(client, ids).json()["id"]
        r = client.post(f"{BASE_URL}/api/patients/{pid}/checkups",
                        json={"tanggal": (date.today() + timedelta(days=3)).isoformat()}, timeout=30)
        assert r.status_code == 400, r.text

    def test_future_persalinan_400(self, client, ids):
        pid = mkpatient(client, ids).json()["id"]
        r = client.put(f"{BASE_URL}/api/patients/{pid}/persalinan",
                       json={"tanggal_persalinan": (date.today() + timedelta(days=2)).isoformat()}, timeout=30)
        assert r.status_code == 400, r.text

    def test_persalinan_before_hpht_400(self, client, ids):
        pid = mkpatient(client, ids, hpht=(date.today() - timedelta(days=30)).isoformat()).json()["id"]
        r = client.put(f"{BASE_URL}/api/patients/{pid}/persalinan",
                       json={"tanggal_persalinan": (date.today() - timedelta(days=60)).isoformat()}, timeout=30)
        assert r.status_code == 400, r.text


# ---------- compute_status phase filtering ----------
class TestStatusPhase:
    def test_anc_today_then_delivery_5d_ago_is_terlambat(self, client, ids):
        hpht = (date.today() - timedelta(weeks=39)).isoformat()
        pid = mkpatient(client, ids, nama="TEST_Reg2Phase", hpht=hpht).json()["id"]
        c = client.post(f"{BASE_URL}/api/patients/{pid}/checkups",
                        json={"tanggal": date.today().isoformat(), "sistolik": 110, "diastolik": 70}, timeout=30)
        assert c.status_code == 200 and c.json()["jenis"] == "anc"
        deliv = date.today() - timedelta(days=5)
        p = client.put(f"{BASE_URL}/api/patients/{pid}/persalinan",
                       json={"tanggal_persalinan": deliv.isoformat()}, timeout=30).json()
        assert p["fase"] == "nifas"
        assert p["kunjungan_berikutnya"] == "KF1"
        assert p["jadwal_berikutnya"] == (deliv + timedelta(days=2)).isoformat()
        assert p["status"] == "terlambat", p
        assert p["kontrol_terakhir"] is None, "ANC checkup must not count as KF kontrol_terakhir"
        # GET verifies persistence of same computed status
        g = client.get(f"{BASE_URL}/api/patients/{pid}", timeout=30).json()["pasien"]
        assert g["status"] == "terlambat"

    def test_kf_checkup_clears_overdue(self, client, ids):
        hpht = (date.today() - timedelta(weeks=39)).isoformat()
        pid = mkpatient(client, ids, nama="TEST_Reg2KF", hpht=hpht).json()["id"]
        deliv = date.today() - timedelta(days=5)
        client.put(f"{BASE_URL}/api/patients/{pid}/persalinan",
                   json={"tanggal_persalinan": deliv.isoformat()}, timeout=30)
        c = client.post(f"{BASE_URL}/api/patients/{pid}/checkups",
                        json={"tanggal": (deliv + timedelta(days=2)).isoformat()}, timeout=30)
        assert c.status_code == 200 and c.json()["jenis"] == "kf"
        g = client.get(f"{BASE_URL}/api/patients/{pid}", timeout=30).json()["pasien"]
        assert g["kunjungan_berikutnya"] == "KF2"
        assert g["status"] == "sudah_kontrol", g

    def test_dashboard_counts_overdue_nifas(self, client, ids):
        hpht = (date.today() - timedelta(weeks=39)).isoformat()
        pid = mkpatient(client, ids, nama="TEST_Reg2Dash", hpht=hpht).json()["id"]
        client.post(f"{BASE_URL}/api/patients/{pid}/checkups",
                    json={"tanggal": date.today().isoformat()}, timeout=30)
        client.put(f"{BASE_URL}/api/patients/{pid}/persalinan",
                   json={"tanggal_persalinan": (date.today() - timedelta(days=5)).isoformat()}, timeout=30)
        d = client.get(f"{BASE_URL}/api/dashboard", timeout=30).json()
        assert any(p["id"] == pid for p in d["perlu_tindakan"]), "overdue nifas missing from perlu_tindakan"
        assert d["stats"]["terlambat"] >= 1


# ---------- lockout (must run last / cleans up) ----------
class TestLockout:
    def test_lockout_then_correct_password_rejected(self):
        clear_login_attempts()
        s = requests.Session()
        codes = []
        for _ in range(5):
            codes.append(s.post(f"{BASE_URL}/api/auth/login",
                                json={"username": "admin", "password": "salah-bf"}, timeout=30).status_code)
        assert codes[:5] == [401] * 5, codes
        # 6th wrong attempt -> 429
        r6 = s.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": "salah-bf"}, timeout=30)
        assert r6.status_code == 429, f"expected 429 got {r6.status_code}"
        assert "Terlalu banyak percobaan login" in r6.json()["detail"]
        # correct password also blocked while locked
        rc = s.post(f"{BASE_URL}/api/auth/login", json=CREDS, timeout=30)
        assert rc.status_code == 429, f"correct password should be blocked during lockout, got {rc.status_code}"
        clear_login_attempts()
        # after clearing, admin can log in again
        ok = s.post(f"{BASE_URL}/api/auth/login", json=CREDS, timeout=30)
        assert ok.status_code == 200, ok.text

    def test_teardown_login_attempts_clean(self):
        clear_login_attempts()
        r = requests.post(f"{BASE_URL}/api/auth/login", json=CREDS, timeout=30)
        assert r.status_code == 200
