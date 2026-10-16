# Referensi Server & Dependency — BidanKu

Dokumen referensi untuk memeriksa dependency dan menjalankan server. Terakhir diperbarui: 13 Oktober 2026.

## Arsitektur

```
React (frontend, port 3000) ──► FastAPI (backend, port 8001) ──► MongoDB (lokal)
         │                            │
         └── prefix /api/*  ──────────┘ (semua endpoint backend diawali /api)
```

| Komponen | Teknologi | Port |
|---|---|---|
| Frontend | React 19 + Tailwind + Shadcn UI (CRA/craco, hot reload) | 3000 |
| Backend | FastAPI + Motor (async MongoDB) + Uvicorn | 8001 |
| Database | MongoDB lokal | 27017 |
| Desktop | Electron (build .exe via GitHub Actions) | — |

Kedua service dikelola **supervisor** dengan hot reload (perubahan kode otomatis dimuat ulang; restart hanya perlu jika mengubah `.env` atau install dependency).

## Dependency Backend (`backend/requirements.txt`)

| Paket | Fungsi |
|---|---|
| `fastapi==0.110.1`, `uvicorn==0.25.0` | Web framework & ASGI server |
| `motor==3.3.1`, `pymongo==4.6.3` | Driver MongoDB (async + sync) |
| `pydantic>=2.6.4`, `email-validator` | Validasi model data |
| `pyjwt>=2.10.1`, `python-jose>=3.3.0` | Token JWT (login klinik & portal pasien) |
| `bcrypt==4.1.3`, `passlib>=1.7.4` | Hash password |
| `cryptography`, `boto3`, `requests-oauthlib`, `requests` | Utilitas keamanan/HTTP |
| `python-dotenv` | Membaca `.env` |
| `python-multipart` | Upload form data |
| `pandas`, `numpy`, `jq`, `typer`, `tzdata` | Utilitas bawaan lingkungan |
| `pytest`, `pytest-xdist` | Testing (paralel 2 worker, `-n 2 --dist loadscope`) |
| `black`, `isort`, `flake8`, `mypy` | Linting/formatting |

> Catatan 13 Okt 2026: `emergentintegrations` dihapus (tidak dipakai). Auth memakai JWT via **httpOnly cookie** (`bidanku_token` untuk klinik, `bidanku_pasien` untuk portal; `samesite="none"`, `secure`), dengan fallback header `Authorization: Bearer` untuk API test.

## Environment Variables

### `backend/.env`
| Key | Fungsi |
|---|---|
| `MONGO_URL` | Koneksi MongoDB |
| `DB_NAME` | Nama database |
| `JWT_SECRET` | Secret penandatanganan token |
| `CORS_ORIGINS` | Origin yang diizinkan |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_EMAIL` | Seed akun admin pertama |

### `frontend/.env`
| Key | Fungsi |
|---|---|
| `REACT_APP_BACKEND_URL` | URL backend untuk request API |
| `WDS_SOCKET_PORT` | Hot reload websocket |
| `ENABLE_HEALTH_CHECK` | Health check dev server |

## Koleksi MongoDB Utama

| Koleksi | Isi |
|---|---|
| `users` | Akun klinik/bidan (multi-user, dibuat via menu Profil) |
| `patient_users` | Akun portal pasien (auto-generate per pasien) |
| `patients` | Data pasien (termasuk `no_rm`, `no_bpjs`) |
| `checkups` | Riwayat kontrol ANC/PNC (TTV, detail bayi, fisik bayi PNC) |
| `persalinan` | Data persalinan & bayi lahir |
| `pemantauan_harian/mingguan`, `ttd`, `gerakan`, `persiapan`, `pengingat` | Isian mandiri pasien dari portal `/ibu` |
| `edukasi`, `templates` | Pesan edukasi & template WA |
| `pengaturan` | Pengaturan klinik (WA bidan, template janji & follow-up) |
| `followup_log` | Penanda follow-up mingguan per pasien |
| `notif_seen` | Penanda notifikasi terakhir dibaca per akun bidan (sejak 16 Okt 2026) |
| `login_attempts` | Proteksi brute-force (lockout 5x → 15 menit) |

## Perintah Operasional

```bash
# Status / restart service
sudo supervisorctl status
sudo supervisorctl restart backend
sudo supervisorctl restart frontend

# Log backend
tail -n 100 /var/log/supervisor/backend.err.log

# Jalankan semua test backend (butuh env REACT_APP_BACKEND_URL)
cd /app/backend
export REACT_APP_BACKEND_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
python -m pytest tests/ -q

# Install dependency Python baru (jangan edit requirements.txt manual)
pip install <paket> && pip freeze > /app/backend/requirements.txt

# Install dependency frontend (selalu yarn, bukan npm)
cd /app/frontend && yarn add <paket>
```

## Struktur Rute

- **Klinik/bidan**: `/login` → `/` (dashboard), `/pasien`, `/pasien/:id`, `/edukasi`, `/laporan`, `/followup`, `/profil`
- **Portal pasien**: `/ibu/login` → `/ibu`, `/ibu/ttv`, `/ibu/janji`, `/ibu/pantau`, `/ibu/ttd`, `/ibu/gerakan`, `/ibu/bahaya`, `/ibu/persiapan`, `/ibu/edukasi`, `/ibu/perjalanan`, `/ibu/riwayat`, `/ibu/pengaturan`
- **API**: `/api/auth/*` (klinik), `/api/patients/*` + `/api/checkups/*` (data klinik), `/api/pasien/*` (portal), `/api/laporan`, `/api/followup`, `/api/pengaturan`, `/api/notifikasi` (lonceng notifikasi, sejak 16 Okt 2026)
