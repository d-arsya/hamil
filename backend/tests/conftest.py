"""Shared test helpers. Provides ADMIN_PASSWORD read from /app/memory/test_credentials.md
so tests do not hardcode credentials (post SEC-001 fix)."""
import re
from pathlib import Path


def _read_admin_password():
    p = Path("/app/memory/test_credentials.md")
    if not p.exists():
        return "admin123"
    m = re.search(r"Password:\s*`([^`]+)`", p.read_text())
    return m.group(1) if m else "admin123"


ADMIN_PASSWORD = _read_admin_password()
