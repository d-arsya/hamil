"""
Iterasi 18: Notifikasi pemantauan mandiri pasien untuk bidan.
GET /api/notifikasi (agregasi pantau harian/mingguan/TTD/gerakan 7 hari, level, unread per user)
POST /api/notifikasi/read (tandai semua dibaca)
"""
import os
import re
import pytest
import requests
from pathlib import Path

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


def _admin_password():
    m = re.search(r"Password:\s*`([^`]+)`", Path("/app/memory/test_credentials.md").read_text())
    return m.group(1)


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": _admin_password()}, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def pasien_ctx(admin_headers):
    r = requests.post(f"{API}/patients", json={
        "nama": "TEST_i18_Notif", "no_wa": "081200007181", "hpht": "2026-05-01", "alamat": "TEST i18",
    }, headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    akun = requests.post(f"{API}/patients/{pid}/akun", headers=admin_headers, timeout=30).json()
    login = requests.post(f"{API}/pasien/login", json=akun, timeout=30)
    assert login.status_code == 200, login.text
    yield pid, {"Authorization": f"Bearer {login.json()['token']}"}
    requests.delete(f"{API}/patients/{pid}", headers=admin_headers, timeout=30)


class TestNotifikasi:
    def test_pantau_bahaya_muncul_dan_unread(self, admin_headers, pasien_ctx):
        pid, ph = pasien_ctx
        r = requests.post(f"{API}/pasien/pemantauan", json={"kondisi": "Kurang baik", "perdarahan": "Ya"}, headers=ph, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["tanda_bahaya"]

        d = requests.get(f"{API}/notifikasi", headers=admin_headers, timeout=30).json()
        assert "items" in d and "unread" in d
        item = next((i for i in d["items"] if i["patient_id"] == pid and i["tipe"] == "pantau"), None)
        assert item is not None, "isian pemantauan pasien tidak muncul di notifikasi"
        assert item["level"] == "bahaya"
        assert "Perdarahan" in item["ringkasan"]
        assert item["nama"] == "TEST_i18_Notif"
        assert d["unread"] >= 1

    def test_gerakan_kurang_level_waspada(self, admin_headers, pasien_ctx):
        pid, ph = pasien_ctx
        r = requests.post(f"{API}/pasien/gerakan", headers=ph, timeout=30)
        assert r.status_code == 200, r.text
        d = requests.get(f"{API}/notifikasi", headers=admin_headers, timeout=30).json()
        item = next((i for i in d["items"] if i["patient_id"] == pid and i["tipe"] == "gerakan"), None)
        assert item is not None
        assert item["level"] == "waspada"  # 1x < 10x

    def test_tandai_dibaca(self, admin_headers, pasien_ctx):
        r = requests.post(f"{API}/notifikasi/read", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        d = requests.get(f"{API}/notifikasi", headers=admin_headers, timeout=30).json()
        assert d["unread"] == 0

    def test_requires_auth(self):
        r = requests.get(f"{API}/notifikasi", timeout=30)
        assert r.status_code in (401, 403)
