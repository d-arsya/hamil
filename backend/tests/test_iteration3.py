"""Iteration 3 tests: Kupon Pijat Bayi, Identitas baru, Edukasi chatbox."""
import os
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
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

FASE_LIST = ["trimester_1", "trimester_2", "trimester_3", "trimester_4", "nifas"]


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


@pytest.fixture(scope="module")
def created_pids(client):
    ids = []
    yield ids
    for pid in ids:
        try:
            client.delete(f"{BASE_URL}/api/patients/{pid}", timeout=30)
        except Exception:
            pass


# ---------- IDENTITAS BARU ----------
class TestIdentitasBaru:
    def test_create_with_new_fields_and_age(self, client, created_pids):
        birth = (date.today() - timedelta(days=365 * 30 + 100)).isoformat()  # ~30 yrs
        hpht = (date.today() - timedelta(days=70)).isoformat()
        payload = {
            "nama": "TEST_Identitas", "no_wa": "081200000001", "hpht": hpht,
            "tanggal_lahir": birth,
            "penyakit_penyerta": "Hipertensi",
            "keluhan_utama": "Mual berat",
            "gravida": 2, "para": 1, "abortus": 0,
        }
        r = client.post(f"{BASE_URL}/api/patients", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        p = r.json()
        created_pids.append(p["id"])
        assert p["tanggal_lahir"] == birth
        assert p["penyakit_penyerta"] == "Hipertensi"
        assert p["keluhan_utama"] == "Mual berat"
        assert p["usia_tahun"] == 30
        # GET persistence
        g = client.get(f"{BASE_URL}/api/patients/{p['id']}", timeout=30).json()["pasien"]
        assert g["usia_tahun"] == 30
        assert g["penyakit_penyerta"] == "Hipertensi"
        assert g["keluhan_utama"] == "Mual berat"

    def test_future_birth_date_400(self, client):
        future = (date.today() + timedelta(days=10)).isoformat()
        r = client.post(f"{BASE_URL}/api/patients", json={
            "nama": "TEST_FutureBirth", "no_wa": "0812", "hpht": date.today().isoformat(),
            "tanggal_lahir": future,
        }, timeout=30)
        assert r.status_code == 400
        assert "lahir" in r.json().get("detail", "").lower()


# ---------- KUPON PIJAT BAYI ----------
class TestKupon:
    def test_kupon_flow(self, client, created_pids):
        hpht = (date.today() - timedelta(weeks=30)).isoformat()
        pid = client.post(f"{BASE_URL}/api/patients", json={
            "nama": "TEST_Kupon", "no_wa": "081200000002", "hpht": hpht,
        }, timeout=30).json()["id"]
        created_pids.append(pid)

        # 5 checkups -> not eligible
        for i in range(5):
            tgl = (date.today() - timedelta(days=i)).isoformat()
            r = client.post(f"{BASE_URL}/api/patients/{pid}/checkups", json={"tanggal": tgl}, timeout=30)
            assert r.status_code == 200
        p = client.get(f"{BASE_URL}/api/patients/{pid}", timeout=30).json()["pasien"]
        assert p["kupon_eligible"] is False
        assert p["kupon_diklaim"] is False

        # 6th checkup -> eligible
        client.post(f"{BASE_URL}/api/patients/{pid}/checkups",
                    json={"tanggal": (date.today() - timedelta(days=5)).isoformat()}, timeout=30)
        p = client.get(f"{BASE_URL}/api/patients/{pid}", timeout=30).json()["pasien"]
        assert p["kupon_eligible"] is True
        assert p["kupon_diklaim"] is False

        # Claim
        r = client.put(f"{BASE_URL}/api/patients/{pid}/kupon", json={"diklaim": True}, timeout=30)
        assert r.status_code == 200
        assert r.json()["kupon_diklaim"] is True
        p = client.get(f"{BASE_URL}/api/patients/{pid}", timeout=30).json()["pasien"]
        assert p["kupon_diklaim"] is True
        assert p["kupon_eligible"] is True

        # Unclaim
        r = client.put(f"{BASE_URL}/api/patients/{pid}/kupon", json={"diklaim": False}, timeout=30)
        assert r.status_code == 200
        assert r.json()["kupon_diklaim"] is False

    def test_kupon_missing_patient_404(self, client):
        r = client.put(f"{BASE_URL}/api/patients/no-such/kupon", json={"diklaim": True}, timeout=30)
        assert r.status_code == 404


# ---------- EDUKASI ----------
class TestEdukasi:
    def test_get_edukasi_shape(self, client):
        r = client.get(f"{BASE_URL}/api/edukasi", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for f in FASE_LIST:
            assert f in d and isinstance(d[f], list)

    def test_post_and_delete_edukasi(self, client):
        r = client.post(f"{BASE_URL}/api/edukasi/trimester_1", json={"isi": "TEST_pesan edukasi"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["fase"] == "trimester_1"
        assert d["isi"] == "TEST_pesan edukasi"
        assert "id" in d and "created_at" in d and "oleh" in d
        assert "_id" not in d
        mid = d["id"]

        got = client.get(f"{BASE_URL}/api/edukasi", timeout=30).json()
        assert any(m["id"] == mid for m in got["trimester_1"])

        dr = client.delete(f"{BASE_URL}/api/edukasi/{mid}", timeout=30)
        assert dr.status_code == 200 and dr.json().get("ok") is True
        got2 = client.get(f"{BASE_URL}/api/edukasi", timeout=30).json()
        assert not any(m["id"] == mid for m in got2["trimester_1"])

    def test_post_invalid_fase_400(self, client):
        r = client.post(f"{BASE_URL}/api/edukasi/foobar", json={"isi": "x"}, timeout=30)
        assert r.status_code == 400
        assert "fase" in r.json().get("detail", "").lower()

    def test_post_empty_isi_400(self, client):
        r = client.post(f"{BASE_URL}/api/edukasi/nifas", json={"isi": "   "}, timeout=30)
        assert r.status_code == 400

    def test_delete_missing_404(self, client):
        r = client.delete(f"{BASE_URL}/api/edukasi/no-such-msg", timeout=30)
        assert r.status_code == 404

    def test_auth_required(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        assert s.get(f"{BASE_URL}/api/edukasi", timeout=30).status_code == 401
        assert s.post(f"{BASE_URL}/api/edukasi/nifas", json={"isi": "x"}, timeout=30).status_code == 401
