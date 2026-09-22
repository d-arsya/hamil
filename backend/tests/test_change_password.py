"""Tests for the security audit fix: change-password endpoint & password persistence.

Active admin password is read from /app/memory/test_credentials.md.
After all mutation tests, password is restored to the current value.
"""
import os
import re
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")

CRED_FILE = "/app/memory/test_credentials.md"


def _read_admin_password():
    with open(CRED_FILE) as f:
        for line in f:
            m = re.search(r"Password:\s*`([^`]+)`", line)
            if m:
                return m.group(1)
    raise RuntimeError("Admin password not found in test_credentials.md")


ADMIN_USER = "admin"
# The active password (post-audit). Per review request the actual live password is 'Bidan#Aman2026xY9'.
# We probe both the credentials file value and the review-provided value so tests are resilient.
CRED_FILE_PASSWORD = _read_admin_password()
ACTIVE_PASSWORD_CANDIDATES = ["Bidan#Aman2026xY9", CRED_FILE_PASSWORD]


def _login(password):
    return requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": ADMIN_USER, "password": password},
        timeout=15,
    )


def _get_active_password():
    for p in ACTIVE_PASSWORD_CANDIDATES:
        r = _login(p)
        if r.status_code == 200:
            return p, r.json()["token"]
    pytest.fail(f"Neither candidate password worked. Tried: {ACTIVE_PASSWORD_CANDIDATES}")


@pytest.fixture(scope="module")
def active_creds():
    pw, token = _get_active_password()
    yield {"password": pw, "token": token}


# ---- Security audit fix: old default password is disabled ----
class TestOldPasswordsRejected:
    def test_login_admin123_rejected(self):
        r = _login("admin123")
        assert r.status_code == 401, f"admin123 must be rejected, got {r.status_code}"

    def test_login_env_password_rejected(self):
        # env value is BdK#m7Q2vX9pL4zR — used only at first seed; should now be invalid
        r = _login("BdK#m7Q2vX9pL4zR")
        assert r.status_code == 401

    def test_login_active_password_ok(self, active_creds):
        r = _login(active_creds["password"])
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 10
        assert data["user"]["username"] == "admin"


# ---- Change-password endpoint ----
class TestChangePasswordAPI:
    def test_change_password_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            json={"password_lama": "x", "password_baru": "yyyyyyyy"},
            timeout=10,
        )
        assert r.status_code in (401, 403), f"unauthenticated must be 401/403, got {r.status_code}"

    def test_change_password_wrong_old(self, active_creds):
        r = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {active_creds['token']}"},
            json={"password_lama": "wrong-old-xyz", "password_baru": "SomeNewPass123"},
            timeout=15,
        )
        assert r.status_code == 400
        body = r.json()
        assert "salah" in (body.get("detail", "") or "").lower() or "detail" in body

    def test_change_password_too_short(self, active_creds):
        r = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {active_creds['token']}"},
            json={"password_lama": active_creds["password"], "password_baru": "short7!"},
            timeout=15,
        )
        assert r.status_code == 400
        body = r.json()
        assert "8" in (body.get("detail", "") or "") or "minimal" in (body.get("detail", "") or "").lower()

    def test_change_password_success_then_login_and_restore(self, active_creds):
        original = active_creds["password"]
        token = active_creds["token"]
        temp_pw = "TempPass#Sec2026!"

        # Change to temp
        r = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={"password_lama": original, "password_baru": temp_pw},
            timeout=15,
        )
        assert r.status_code == 200, f"change password failed: {r.status_code} {r.text}"
        assert r.json().get("ok") is True

        # Old password should now fail
        r_old = _login(original)
        assert r_old.status_code == 401

        # New password should log in
        r_new = _login(temp_pw)
        assert r_new.status_code == 200
        new_token = r_new.json()["token"]

        # Restore original password (critical: keep test_credentials.md valid)
        r_restore = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {new_token}"},
            json={"password_lama": temp_pw, "password_baru": original},
            timeout=15,
        )
        assert r_restore.status_code == 200

        # Confirm restore
        r_final = _login(original)
        assert r_final.status_code == 200
