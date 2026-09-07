from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
from datetime import datetime, timezone, date, timedelta
from typing import Optional

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"

# Jadwal ANC 6x (minggu ke-) dan Kunjungan Nifas (hari ke-)
ANC_WEEKS = [12, 16, 26, 32, 36, 39]
KF_DAYS = [2, 7, 14, 42]

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(hours=12)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds:
        raise HTTPException(status_code=401, detail="Belum login")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token tidak valid atau kedaluwarsa")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
    return user


def parse_date(value: str, field: str) -> date:
    try:
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail=f"Format {field} tidak valid (gunakan YYYY-MM-DD)")


def validate_patient_dates(hpht: str, tanggal_lahir: Optional[str] = None):
    hpht_date = parse_date(hpht, "tanggal HPHT")
    if hpht_date > date.today():
        raise HTTPException(status_code=400, detail="Tanggal HPHT tidak boleh di masa depan")
    if tanggal_lahir:
        lahir = parse_date(tanggal_lahir, "tanggal lahir")
        if lahir > date.today():
            raise HTTPException(status_code=400, detail="Tanggal lahir tidak boleh di masa depan")
    return hpht_date


def validate_gpa(data):
    if data.gravida < 1 or data.para < 0 or data.abortus < 0:
        raise HTTPException(status_code=400, detail="Nilai G/P/A tidak valid (Gravida minimal 1, lainnya minimal 0)")


class LoginInput(BaseModel):
    username: str
    password: str


class PatientInput(BaseModel):
    nama: str
    no_wa: str
    alamat: Optional[str] = ""
    tanggal_lahir: Optional[str] = None
    hpht: str
    gravida: int = 1
    para: int = 0
    abortus: int = 0
    penyakit_penyerta: Optional[str] = ""
    keluhan_utama: Optional[str] = ""
    riwayat: Optional[str] = ""
    catatan: Optional[str] = ""


class CheckupInput(BaseModel):
    tanggal: Optional[str] = None
    sistolik: Optional[int] = None
    diastolik: Optional[int] = None
    berat_badan: Optional[float] = None
    tinggi_fundus: Optional[float] = None
    djj: Optional[int] = None
    keluhan: Optional[str] = ""
    catatan: Optional[str] = ""


class DeliveryInput(BaseModel):
    tanggal_persalinan: Optional[str] = None


def compute_status(pasien: dict, checkups: list, today: Optional[date] = None) -> dict:
    today = today or date.today()
    hpht = date.fromisoformat(pasien["hpht"])
    hpl = hpht + timedelta(days=280)
    persalinan = date.fromisoformat(pasien["tanggal_persalinan"]) if pasien.get("tanggal_persalinan") else None

    usia_minggu = None
    usia_hari = None
    hari_nifas = None

    if persalinan:
        fase = "nifas"
        phase_checks = [c for c in checkups if c.get("jenis") == "kf"]
        hari_nifas = (today - persalinan).days
        done = len(phase_checks)
        if done >= len(KF_DAYS):
            next_date, prev_date, kunjungan = None, persalinan + timedelta(days=KF_DAYS[-1]), None
        else:
            next_date = persalinan + timedelta(days=KF_DAYS[done])
            prev_date = persalinan + timedelta(days=KF_DAYS[done - 1]) if done > 0 else persalinan
            kunjungan = f"KF{done + 1}"
    else:
        selisih = (today - hpht).days
        usia_minggu = selisih // 7
        usia_hari = selisih % 7
        fase = "trimester_1" if usia_minggu < 13 else ("trimester_2" if usia_minggu < 28 else "trimester_3")
        phase_checks = [c for c in checkups if c.get("jenis") == "anc"]
        done = len(phase_checks)
        if done >= len(ANC_WEEKS):
            next_date, prev_date, kunjungan = None, hpht + timedelta(weeks=ANC_WEEKS[-1]), None
        else:
            next_date = hpht + timedelta(weeks=ANC_WEEKS[done])
            prev_date = hpht + timedelta(weeks=ANC_WEEKS[done - 1]) if done > 0 else None
            kunjungan = f"K{done + 1}"

    last = max((date.fromisoformat(c["tanggal"]) for c in phase_checks), default=None)

    if next_date is None:
        status = "selesai"
    elif last and prev_date and last >= prev_date:
        status = "sudah_kontrol"
    elif next_date < today:
        status = "terlambat"
    elif next_date == today:
        status = "hari_ini"
    elif (next_date - today).days <= 7:
        status = "mendekati"
    else:
        status = "terjadwal"

    return {
        "fase": fase,
        "usia_minggu": usia_minggu,
        "usia_hari": usia_hari,
        "hari_nifas": hari_nifas,
        "hpl": hpl.isoformat(),
        "jadwal_berikutnya": next_date.isoformat() if next_date else None,
        "kunjungan_berikutnya": kunjungan,
        "status": status,
        "lewat_hpl": (not persalinan) and today > hpl + timedelta(days=7),
        "kontrol_terakhir": last.isoformat() if last else None,
        "jumlah_kontrol": len(phase_checks),
    }


def serialize_patient(p: dict, checkups: list) -> dict:
    usia_tahun = None
    if p.get("tanggal_lahir"):
        lahir = date.fromisoformat(p["tanggal_lahir"])
        today = date.today()
        usia_tahun = today.year - lahir.year - ((today.month, today.day) < (lahir.month, lahir.day))
    anc_total = sum(1 for c in checkups if c.get("jenis") == "anc")
    return {
        "id": p["id"],
        "nama": p["nama"],
        "no_wa": p["no_wa"],
        "alamat": p.get("alamat", ""),
        "tanggal_lahir": p.get("tanggal_lahir"),
        "usia_tahun": usia_tahun,
        "hpht": p["hpht"],
        "gravida": p.get("gravida", 1),
        "para": p.get("para", 0),
        "abortus": p.get("abortus", 0),
        "penyakit_penyerta": p.get("penyakit_penyerta", ""),
        "keluhan_utama": p.get("keluhan_utama", ""),
        "riwayat": p.get("riwayat", ""),
        "catatan": p.get("catatan", ""),
        "tanggal_persalinan": p.get("tanggal_persalinan"),
        "kupon_eligible": anc_total > 5,
        "kupon_diklaim": p.get("kupon_diklaim", False),
        "created_at": p.get("created_at"),
        **compute_status(p, checkups),
    }


async def patient_with_checkups(p: dict) -> dict:
    checks = await db.checkups.find({"patient_id": p["id"]}, {"_id": 0}).to_list(1000)
    return serialize_patient(p, checks)


# ---------- AUTH ----------
@api_router.post("/auth/login")
async def login(data: LoginInput):
    username = data.username.strip().lower()
    attempts = await db.login_attempts.find_one({"username": username})
    if attempts and attempts.get("count", 0) >= 5:
        locked_until = attempts.get("locked_until")
        if locked_until and datetime.now(timezone.utc) < datetime.fromisoformat(locked_until):
            raise HTTPException(status_code=429, detail="Terlalu banyak percobaan login. Coba lagi dalam 15 menit.")
        await db.login_attempts.delete_one({"username": username})
        attempts = None
    user = await db.users.find_one({"username": username})
    if not user or not verify_password(data.password, user["password_hash"]):
        new_count = (attempts.get("count", 0) if attempts else 0) + 1
        update = {"count": new_count}
        if new_count >= 5:
            update["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"username": username}, {"$set": update}, upsert=True)
        raise HTTPException(status_code=401, detail="Username atau password salah")
    await db.login_attempts.delete_one({"username": username})
    token = create_token(user["id"])
    return {"token": token, "user": {"username": user["username"], "nama": user.get("nama", ""), "email": user.get("email", "")}}


@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"username": user["username"], "nama": user.get("nama", ""), "email": user.get("email", "")}


# ---------- DASHBOARD ----------
@api_router.get("/dashboard")
async def dashboard(user=Depends(get_current_user)):
    patients = await db.patients.find({}, {"_id": 0}).to_list(5000)
    serialized = []
    for p in patients:
        serialized.append(await patient_with_checkups(p))
    stats = {
        "total": len(serialized),
        "hamil": sum(1 for p in serialized if p["fase"] != "nifas"),
        "nifas": sum(1 for p in serialized if p["fase"] == "nifas"),
        "hari_ini": sum(1 for p in serialized if p["status"] == "hari_ini"),
        "terlambat": sum(1 for p in serialized if p["status"] == "terlambat"),
        "mendekati": sum(1 for p in serialized if p["status"] == "mendekati"),
    }
    perlu_tindakan = sorted(
        [p for p in serialized if p["status"] in ("terlambat", "hari_ini", "mendekati")],
        key=lambda p: p["jadwal_berikutnya"] or "9999",
    )
    return {"stats": stats, "perlu_tindakan": perlu_tindakan}


# ---------- PATIENTS ----------
@api_router.get("/patients")
async def list_patients(user=Depends(get_current_user)):
    patients = await db.patients.find({}, {"_id": 0}).to_list(5000)
    serialized = []
    for p in patients:
        serialized.append(await patient_with_checkups(p))
    return sorted(serialized, key=lambda p: (p["jadwal_berikutnya"] is None, p["jadwal_berikutnya"] or "9999"))


@api_router.post("/patients")
async def create_patient(data: PatientInput, user=Depends(get_current_user)):
    validate_patient_dates(data.hpht, data.tanggal_lahir)
    validate_gpa(data)
    doc = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "nama": data.nama.strip(),
        "tanggal_persalinan": None,
        "kupon_diklaim": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.patients.insert_one(doc)
    return await patient_with_checkups(doc)


@api_router.get("/patients/{patient_id}")
async def get_patient(patient_id: str, user=Depends(get_current_user)):
    p = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")
    checks = await db.checkups.find({"patient_id": patient_id}, {"_id": 0}).to_list(1000)
    checks.sort(key=lambda c: c["tanggal"])
    return {"pasien": serialize_patient(p, checks), "checkups": checks}


@api_router.put("/patients/{patient_id}")
async def update_patient(patient_id: str, data: PatientInput, user=Depends(get_current_user)):
    validate_patient_dates(data.hpht, data.tanggal_lahir)
    validate_gpa(data)
    result = await db.patients.update_one({"id": patient_id}, {"$set": data.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")
    p = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    return await patient_with_checkups(p)


@api_router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str, user=Depends(get_current_user)):
    result = await db.patients.delete_one({"id": patient_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")
    await db.checkups.delete_many({"patient_id": patient_id})
    return {"ok": True}


@api_router.put("/patients/{patient_id}/persalinan")
async def set_persalinan(patient_id: str, data: DeliveryInput, user=Depends(get_current_user)):
    p = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")
    if data.tanggal_persalinan:
        tgl = parse_date(data.tanggal_persalinan, "tanggal persalinan")
        if tgl > date.today():
            raise HTTPException(status_code=400, detail="Tanggal persalinan tidak boleh di masa depan")
        if tgl < date.fromisoformat(p["hpht"]):
            raise HTTPException(status_code=400, detail="Tanggal persalinan tidak boleh sebelum HPHT")
    await db.patients.update_one({"id": patient_id}, {"$set": {"tanggal_persalinan": data.tanggal_persalinan}})
    p = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    return await patient_with_checkups(p)


# ---------- CHECKUPS ----------
@api_router.post("/patients/{patient_id}/checkups")
async def add_checkup(patient_id: str, data: CheckupInput, user=Depends(get_current_user)):
    p = await db.patients.find_one({"id": patient_id})
    if not p:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")
    jenis = "kf" if p.get("tanggal_persalinan") else "anc"
    count = await db.checkups.count_documents({"patient_id": patient_id, "jenis": jenis})
    tanggal = data.tanggal or date.today().isoformat()
    if parse_date(tanggal, "tanggal kontrol") > date.today():
        raise HTTPException(status_code=400, detail="Tanggal kontrol tidak boleh di masa depan")
    doc = {
        "id": str(uuid.uuid4()),
        "patient_id": patient_id,
        "jenis": jenis,
        "ke": count + 1,
        "tanggal": tanggal,
        "sistolik": data.sistolik,
        "diastolik": data.diastolik,
        "berat_badan": data.berat_badan,
        "tinggi_fundus": data.tinggi_fundus,
        "djj": data.djj,
        "keluhan": data.keluhan or "",
        "catatan": data.catatan or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.checkups.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/checkups/{checkup_id}")
async def delete_checkup(checkup_id: str, user=Depends(get_current_user)):
    result = await db.checkups.delete_one({"id": checkup_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Data kontrol tidak ditemukan")
    return {"ok": True}


@api_router.get("/")
async def root():
    return {"message": "BidanKu API"}


# ---------- KUPON PIJAT BAYI ----------
class KuponInput(BaseModel):
    diklaim: bool


@api_router.put("/patients/{patient_id}/kupon")
async def set_kupon(patient_id: str, data: KuponInput, user=Depends(get_current_user)):
    result = await db.patients.update_one({"id": patient_id}, {"$set": {"kupon_diklaim": data.diklaim}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")
    p = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    return await patient_with_checkups(p)


# ---------- EDUKASI ----------
FASE_EDUKASI = ["trimester_1", "trimester_2", "trimester_3", "trimester_4", "nifas"]


class EdukasiInput(BaseModel):
    isi: str


@api_router.get("/edukasi")
async def get_edukasi(user=Depends(get_current_user)):
    msgs = await db.edukasi.find({}, {"_id": 0}).to_list(5000)
    out = {f: [] for f in FASE_EDUKASI}
    for m in msgs:
        if m.get("fase") in out:
            out[m["fase"]].append(m)
    for f in out:
        out[f].sort(key=lambda m: m["created_at"])
    return out


@api_router.post("/edukasi/{fase}")
async def add_edukasi(fase: str, data: EdukasiInput, user=Depends(get_current_user)):
    if fase not in FASE_EDUKASI:
        raise HTTPException(status_code=400, detail="Fase edukasi tidak dikenal")
    if not data.isi.strip():
        raise HTTPException(status_code=400, detail="Isi edukasi tidak boleh kosong")
    doc = {
        "id": str(uuid.uuid4()),
        "fase": fase,
        "isi": data.isi.strip(),
        "oleh": user.get("nama") or user.get("username", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.edukasi.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/edukasi/{msg_id}")
async def delete_edukasi(msg_id: str, user=Depends(get_current_user)):
    result = await db.edukasi.delete_one({"id": msg_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pesan edukasi tidak ditemukan")
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("username", unique=True)
    await db.checkups.create_index("patient_id")
    await db.login_attempts.create_index("username", unique=True)
    username = os.environ.get("ADMIN_USERNAME", "admin").lower()
    password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"username": username})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "username": username,
            "email": os.environ.get("ADMIN_EMAIL", ""),
            "nama": "Bidan Admin",
            "role": "admin",
            "password_hash": hash_password(password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Admin user seeded: %s", username)
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one({"username": username}, {"$set": {"password_hash": hash_password(password)}})
        logger.info("Admin password re-synced: %s", username)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
