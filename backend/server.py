from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import secrets
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
    if data.no_rm and len(data.no_rm.strip()) > 32:
        raise HTTPException(status_code=400, detail="Nomor RM maksimal 32 karakter")


class LoginInput(BaseModel):
    username: str
    password: str


class ChangePasswordInput(BaseModel):
    password_lama: str
    password_baru: str


class RiwayatItem(BaseModel):
    tahun: Optional[str] = ""
    tempat: Optional[str] = ""
    penolong: Optional[str] = ""
    hasil: Optional[str] = ""
    cara_lahir: Optional[str] = ""
    penyulit: Optional[str] = ""


class PatientInput(BaseModel):
    nama: str
    no_rm: Optional[str] = ""
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
    riwayat_kehamilan: list[RiwayatItem] = []
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
    rencana_tindak_lanjut: Optional[str] = ""
    jenis_kb: Optional[str] = ""
    kontrol_kb: Optional[bool] = False
    imunisasi_diberikan: Optional[str] = ""
    jenis: Optional[str] = None
    ke: Optional[int] = None
    spo2: Optional[int] = None
    suhu: Optional[float] = None
    nadi: Optional[int] = None
    rr: Optional[int] = None
    lila: Optional[float] = None
    tinggi_badan: Optional[float] = None


class DeliveryInput(BaseModel):
    tanggal_persalinan: Optional[str] = None
    nama_anak: Optional[str] = ""
    jenis_kelamin_anak: Optional[str] = ""
    cara_lahir: Optional[str] = ""
    tempat_lahir: Optional[str] = ""
    penolong_persalinan: Optional[str] = ""
    masalah_persalinan: Optional[str] = ""


class ImunisasiInput(BaseModel):
    kode: str
    tanggal: Optional[str] = None
    catatan: Optional[str] = ""


# Jadwal imunisasi dasar mengacu Pedoman Imunisasi IDAI Edisi 7 (2024)
IMUNISASI_SCHEDULE = [
    {"kode": "hb0", "nama": "Hepatitis B (HB-0)", "usia": "0-24 jam", "hari": 0},
    {"kode": "bcg_polio0", "nama": "BCG + Polio 0", "usia": "0-1 bulan", "hari": 0},
    {"kode": "polio1", "nama": "Polio 1", "usia": "1 bulan", "hari": 30},
    {"kode": "bln2", "nama": "DPT-HB-Hib 1 + Polio 2 + PCV 1 + Rotavirus 1", "usia": "2 bulan", "hari": 60},
    {"kode": "bln3", "nama": "DPT-HB-Hib 2 + Polio 3 + Rotavirus 2", "usia": "3 bulan", "hari": 90},
    {"kode": "bln4", "nama": "DPT-HB-Hib 3 + Polio 4 + IPV + PCV 2", "usia": "4 bulan", "hari": 120},
    {"kode": "bln6", "nama": "PCV 3 + Influenza 1", "usia": "6 bulan", "hari": 180},
    {"kode": "mr1", "nama": "Campak/MR 1", "usia": "9 bulan", "hari": 270},
    {"kode": "bln12", "nama": "Hepatitis A 1 + Varisela + PCV Booster", "usia": "12 bulan", "hari": 360},
    {"kode": "mr2", "nama": "Campak/MR 2", "usia": "15 bulan", "hari": 450},
    {"kode": "bln18", "nama": "DPT-HB-Hib Booster + Polio Booster", "usia": "18 bulan", "hari": 540},
]


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
        done_set = {c.get("ke") for c in phase_checks if c.get("ke")}
        next_idx = next((i for i in range(len(KF_DAYS)) if (i + 1) not in done_set), None)
        if next_idx is None:
            next_date, prev_date, kunjungan = None, persalinan + timedelta(days=KF_DAYS[-1]), None
        else:
            next_date = persalinan + timedelta(days=KF_DAYS[next_idx])
            prev_date = persalinan + timedelta(days=KF_DAYS[next_idx - 1]) if next_idx > 0 else persalinan
            kunjungan = f"KF{next_idx + 1}"
    else:
        selisih = (today - hpht).days
        usia_minggu = selisih // 7
        usia_hari = selisih % 7
        fase = "trimester_1" if usia_minggu < 13 else ("trimester_2" if usia_minggu < 28 else "trimester_3")
        phase_checks = [c for c in checkups if c.get("jenis") == "anc"]
        done_set = {c.get("ke") for c in phase_checks if c.get("ke")}
        next_idx = next((i for i in range(len(ANC_WEEKS)) if (i + 1) not in done_set), None)
        if next_idx is None:
            next_date, prev_date, kunjungan = None, hpht + timedelta(weeks=ANC_WEEKS[-1]), None
        else:
            next_date = hpht + timedelta(weeks=ANC_WEEKS[next_idx])
            prev_date = hpht + timedelta(weeks=ANC_WEEKS[next_idx - 1]) if next_idx > 0 else None
            kunjungan = f"K{next_idx + 1}"

    last = max((date.fromisoformat(c["tanggal"]) for c in phase_checks), default=None)

    if persalinan:
        fase_ke, fase_total = min(len(done_set), len(KF_DAYS)), len(KF_DAYS)
    else:
        if fase == "trimester_1":
            fase_ke, fase_total = len(done_set & {1, 2}), 2
        elif fase == "trimester_2":
            fase_ke, fase_total = len(done_set & {3}), 1
        else:
            fase_ke, fase_total = len(done_set & {4, 5, 6}), 3
    selisih_hari = (next_date - today).days if next_date else None

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
        "selisih_hari": selisih_hari,
        "kontrol_fase_ke": fase_ke,
        "kontrol_fase_total": fase_total,
        "kontrol_terakhir": last.isoformat() if last else None,
        "jumlah_kontrol": len(phase_checks),
    }


def build_timeline(p: dict, checkups: list) -> dict:
    hpht = date.fromisoformat(p["hpht"])
    anc = sorted([c for c in checkups if c.get("jenis") == "anc"], key=lambda c: c["tanggal"])
    kf = sorted([c for c in checkups if c.get("jenis") == "kf"], key=lambda c: c["tanggal"])
    anc_by_ke = {c.get("ke"): c for c in anc}
    kf_by_ke = {c.get("ke"): c for c in kf}
    fase_of_idx = {0: "trimester_1", 1: "trimester_1", 2: "trimester_2", 3: "trimester_3", 4: "trimester_3", 5: "trimester_3"}
    items = []
    for i, w in enumerate(ANC_WEEKS):
        done = anc_by_ke.get(i + 1)
        items.append({
            "kode": f"K{i + 1}", "fase": fase_of_idx[i], "minggu": w, "hari": None,
            "target": (hpht + timedelta(weeks=w)).isoformat(),
            "selesai": done is not None,
            "tanggal": done["tanggal"] if done else None,
        })
    persalinan = date.fromisoformat(p["tanggal_persalinan"]) if p.get("tanggal_persalinan") else None
    if persalinan:
        for i, d in enumerate(KF_DAYS):
            done = kf_by_ke.get(i + 1)
            items.append({
                "kode": f"KF{i + 1}", "fase": "nifas", "minggu": None, "hari": d,
                "target": (persalinan + timedelta(days=d)).isoformat(),
                "selesai": done is not None,
                "tanggal": done["tanggal"] if done else None,
            })
    ringkasan = {}
    for fase in ("trimester_1", "trimester_2", "trimester_3", "nifas"):
        g = [i for i in items if i["fase"] == fase]
        if not g:
            continue
        ke = sum(1 for i in g if i["selesai"])
        ringkasan[fase] = {"ke": ke, "total": len(g), "lengkap": ke >= len(g)}
    return {"items": items, "ringkasan": ringkasan}


def serialize_patient(p: dict, checkups: list, imunisasi_done: Optional[list] = None) -> dict:
    usia_tahun = None
    if p.get("tanggal_lahir"):
        lahir = date.fromisoformat(p["tanggal_lahir"])
        today = date.today()
        usia_tahun = today.year - lahir.year - ((today.month, today.day) < (lahir.month, lahir.day))
    anc_total = sum(1 for c in checkups if c.get("jenis") == "anc")
    rtl = next(
        (c.get("rencana_tindak_lanjut") for c in sorted(checkups, key=lambda c: c["tanggal"], reverse=True) if c.get("rencana_tindak_lanjut")),
        None,
    )
    imu_next = None
    if p.get("tanggal_persalinan"):
        done_kodes = {r["kode"] for r in (imunisasi_done or [])}
        lahir_bayi = date.fromisoformat(p["tanggal_persalinan"])
        for s in IMUNISASI_SCHEDULE:
            if s["kode"] not in done_kodes:
                imu_next = {**s, "tanggal": (lahir_bayi + timedelta(days=s["hari"])).isoformat()}
                break
    return {
        "id": p["id"],
        "nama": p["nama"],
        "no_rm": p.get("no_rm", ""),
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
        "golongan_darah": p.get("golongan_darah", ""),
        "nama_pendamping": p.get("nama_pendamping", ""),
        "kontak_darurat": p.get("kontak_darurat", ""),
        "faskes": p.get("faskes", ""),
        "profil_lengkap": p.get("profil_lengkap", False),
        "riwayat": p.get("riwayat", ""),
        "riwayat_kehamilan": p.get("riwayat_kehamilan", []),
        "catatan": p.get("catatan", ""),
        "tanggal_persalinan": p.get("tanggal_persalinan"),
        "nama_anak": p.get("nama_anak", ""),
        "jenis_kelamin_anak": p.get("jenis_kelamin_anak", ""),
        "cara_lahir": p.get("cara_lahir", ""),
        "tempat_lahir": p.get("tempat_lahir", ""),
        "penolong_persalinan": p.get("penolong_persalinan", ""),
        "masalah_persalinan": p.get("masalah_persalinan", ""),
        "anc_lengkap": anc_total >= 6,
        "rtl_berikutnya": rtl,
        "imunisasi_berikutnya": imu_next,
        "kupon_eligible": anc_total > 5,
        "kupon_diklaim": p.get("kupon_diklaim", False),
        "created_at": p.get("created_at"),
        **compute_status(p, checkups),
    }


async def patient_with_checkups(p: dict) -> dict:
    checks = await db.checkups.find({"patient_id": p["id"]}, {"_id": 0}).to_list(1000)
    imu = await db.imunisasi.find({"patient_id": p["id"]}, {"_id": 0}).to_list(100)
    return serialize_patient(p, checks, imu)


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


@api_router.post("/auth/change-password")
async def change_password(data: ChangePasswordInput, user=Depends(get_current_user)):
    if len(data.password_baru) < 8:
        raise HTTPException(status_code=400, detail="Password baru minimal 8 karakter")
    row = await db.users.find_one({"id": user["id"]})
    if not row or not verify_password(data.password_lama, row["password_hash"]):
        raise HTTPException(status_code=400, detail="Password lama salah")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(data.password_baru)}})
    return {"ok": True}


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
    imu = await db.imunisasi.find({"patient_id": patient_id}, {"_id": 0}).to_list(100)
    return {"pasien": serialize_patient(p, checks, imu), "checkups": checks, "timeline": build_timeline(p, checks)}


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
    await db.imunisasi.delete_many({"patient_id": patient_id})
    await db.imunisasi_tt.delete_many({"patient_id": patient_id})
    await db.patient_users.delete_many({"patient_id": patient_id})
    await db.pemantauan_harian.delete_many({"patient_id": patient_id})
    await db.pemantauan_mingguan.delete_many({"patient_id": patient_id})
    await db.ttd.delete_many({"patient_id": patient_id})
    await db.gerakan.delete_many({"patient_id": patient_id})
    await db.persiapan.delete_many({"patient_id": patient_id})
    await db.pengingat.delete_many({"patient_id": patient_id})
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
    await db.patients.update_one({"id": patient_id}, {"$set": {
        "tanggal_persalinan": data.tanggal_persalinan,
        "nama_anak": data.nama_anak or "",
        "jenis_kelamin_anak": data.jenis_kelamin_anak or "",
        "cara_lahir": data.cara_lahir or "",
        "tempat_lahir": data.tempat_lahir or "",
        "penolong_persalinan": data.penolong_persalinan or "",
        "masalah_persalinan": data.masalah_persalinan or "",
    }})
    p = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    return await patient_with_checkups(p)


# ---------- CHECKUPS ----------
@api_router.post("/patients/{patient_id}/checkups")
async def add_checkup(patient_id: str, data: CheckupInput, user=Depends(get_current_user)):
    p = await db.patients.find_one({"id": patient_id})
    if not p:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")
    jenis = data.jenis if data.jenis in ("anc", "kf") else ("kf" if p.get("tanggal_persalinan") else "anc")
    max_ke = len(KF_DAYS) if jenis == "kf" else len(ANC_WEEKS)
    if data.ke is not None:
        if not (1 <= data.ke <= max_ke):
            raise HTTPException(status_code=400, detail=f"Nomor kunjungan harus antara 1 dan {max_ke}")
        dup = await db.checkups.find_one({"patient_id": patient_id, "jenis": jenis, "ke": data.ke})
        if dup:
            raise HTTPException(status_code=400, detail=f"Kunjungan {'KF' if jenis == 'kf' else 'K'}{data.ke} sudah pernah dicatat")
        count = data.ke - 1
    else:
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
        "rencana_tindak_lanjut": data.rencana_tindak_lanjut or "",
        "jenis_kb": data.jenis_kb or "",
        "kontrol_kb": bool(data.kontrol_kb),
        "imunisasi_diberikan": data.imunisasi_diberikan or "",
        "spo2": data.spo2,
        "suhu": data.suhu,
        "nadi": data.nadi,
        "rr": data.rr,
        "lila": data.lila,
        "tinggi_badan": data.tinggi_badan,
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


@api_router.get("/patients/{patient_id}/imunisasi")
async def get_imunisasi(patient_id: str, user=Depends(get_current_user)):
    p = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")
    if not p.get("tanggal_persalinan"):
        return {"usia_bayi_hari": None, "items": []}
    lahir = date.fromisoformat(p["tanggal_persalinan"])
    today = date.today()
    records = await db.imunisasi.find({"patient_id": patient_id}, {"_id": 0}).to_list(100)
    done_map = {r["kode"]: r for r in records}
    items = []
    for s in IMUNISASI_SCHEDULE:
        target = lahir + timedelta(days=s["hari"])
        rec = done_map.get(s["kode"])
        if rec:
            status = "selesai"
        elif target < today - timedelta(days=7):
            status = "terlambat"
        elif target <= today:
            status = "hari_ini"
        elif (target - today).days <= 7:
            status = "mendekati"
        else:
            status = "terjadwal"
        items.append({**s, "tanggal_target": target.isoformat(), "status": status, "record": rec})
    return {"usia_bayi_hari": (today - lahir).days, "items": items}


@api_router.post("/patients/{patient_id}/imunisasi")
async def add_imunisasi(patient_id: str, data: ImunisasiInput, user=Depends(get_current_user)):
    p = await db.patients.find_one({"id": patient_id})
    if not p:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")
    if not p.get("tanggal_persalinan"):
        raise HTTPException(status_code=400, detail="Catat tanggal persalinan dulu sebelum mengisi imunisasi")
    sched = next((s for s in IMUNISASI_SCHEDULE if s["kode"] == data.kode), None)
    if not sched:
        raise HTTPException(status_code=400, detail="Kode imunisasi tidak dikenal")
    existing = await db.imunisasi.find_one({"patient_id": patient_id, "kode": data.kode})
    if existing:
        raise HTTPException(status_code=400, detail="Imunisasi ini sudah tercatat")
    tanggal = data.tanggal or date.today().isoformat()
    if parse_date(tanggal, "tanggal imunisasi") > date.today():
        raise HTTPException(status_code=400, detail="Tanggal imunisasi tidak boleh di masa depan")
    doc = {
        "id": str(uuid.uuid4()),
        "patient_id": patient_id,
        "kode": data.kode,
        "nama": sched["nama"],
        "tanggal": tanggal,
        "catatan": data.catatan or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.imunisasi.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/imunisasi/{record_id}")
async def delete_imunisasi(record_id: str, user=Depends(get_current_user)):
    result = await db.imunisasi.delete_one({"id": record_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Catatan imunisasi tidak ditemukan")
    return {"ok": True}


# ---------- OPSI PENYULIT CUSTOM ----------
PENYULIT_DEFAULT = {"Tidak ada", "Preeklamsia", "Eklampsia", "Vasa previa", "Gangguan plasenta", "Perdarahan akhir kehamilan", "Persalinan prematur", "Lainnya"}


@api_router.get("/options/penyulit")
async def get_penyulit_options(user=Depends(get_current_user)):
    vals = await db.patients.distinct("riwayat_kehamilan.penyulit")
    default_lower = {d.lower() for d in PENYULIT_DEFAULT}
    seen = set()
    custom = []
    for v in sorted({v.strip() for v in vals if v and v.strip()}):
        low = v.lower()
        if low in default_lower or low in seen:
            continue
        seen.add(low)
        custom.append(v)
    return {"custom": custom}


# ---------- TEMPLATE WA CUSTOM ----------
class TemplateInput(BaseModel):
    judul: str
    isi: str


@api_router.get("/templates")
async def get_templates(user=Depends(get_current_user)):
    return await db.templates.find({}, {"_id": 0}).sort("created_at", 1).to_list(200)


@api_router.post("/templates")
async def add_template(data: TemplateInput, user=Depends(get_current_user)):
    if not data.judul.strip() or not data.isi.strip():
        raise HTTPException(status_code=400, detail="Judul dan isi template wajib diisi")
    if len(data.judul) > 200 or len(data.isi) > 5000:
        raise HTTPException(status_code=400, detail="Judul maksimal 200 karakter, isi maksimal 5000 karakter")
    dup = await db.templates.find_one({"judul": data.judul.strip()})
    if dup:
        raise HTTPException(status_code=400, detail="Template dengan judul ini sudah ada")
    doc = {
        "id": str(uuid.uuid4()),
        "judul": data.judul.strip(),
        "isi": data.isi.strip(),
        "oleh": user.get("nama") or user.get("username", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.templates.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str, user=Depends(get_current_user)):
    result = await db.templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template tidak ditemukan")
    return {"ok": True}


# ---------- LAPORAN ----------
@api_router.get("/laporan")
async def laporan(user=Depends(get_current_user)):
    patients = await db.patients.find({}, {"_id": 0}).to_list(5000)
    checks = await db.checkups.find({}, {"_id": 0}).to_list(50000)
    by_patient = {}
    for c in checks:
        by_patient.setdefault(c["patient_id"], []).append(c)
    today = date.today()

    def done_ke(pid, jenis, ke):
        return any(c.get("jenis") == jenis and c.get("ke") == ke for c in by_patient.get(pid, []))

    anc_stats = []
    for i, w in enumerate(ANC_WEEKS):
        eligible = done = 0
        for p in patients:
            target = date.fromisoformat(p["hpht"]) + timedelta(weeks=w)
            if target <= today or p.get("tanggal_persalinan"):
                eligible += 1
                if done_ke(p["id"], "anc", i + 1):
                    done += 1
        anc_stats.append({"kode": f"K{i + 1}", "label": f"K{i + 1} (mgg {w})", "eligible": eligible, "done": done, "persen": round(done / eligible * 100) if eligible else None})

    kf_stats = []
    for i, d in enumerate(KF_DAYS):
        eligible = done = 0
        for p in patients:
            if not p.get("tanggal_persalinan"):
                continue
            if date.fromisoformat(p["tanggal_persalinan"]) + timedelta(days=d) <= today:
                eligible += 1
                if done_ke(p["id"], "kf", i + 1):
                    done += 1
        kf_stats.append({"kode": f"KF{i + 1}", "label": f"KF{i + 1} (hari {d})", "eligible": eligible, "done": done, "persen": round(done / eligible * 100) if eligible else None})

    tuntas = lost = 0
    for p in patients:
        st = compute_status(p, by_patient.get(p["id"], []), today)
        if st["status"] == "terlambat":
            lost += 1
            continue
        due_ok = True
        hpht = date.fromisoformat(p["hpht"])
        if not p.get("tanggal_persalinan"):
            for i, w in enumerate(ANC_WEEKS):
                if hpht + timedelta(weeks=w) <= today and not done_ke(p["id"], "anc", i + 1):
                    due_ok = False
                    break
        else:
            pers = date.fromisoformat(p["tanggal_persalinan"])
            for i, d in enumerate(KF_DAYS):
                if pers + timedelta(days=d) <= today and not done_ke(p["id"], "kf", i + 1):
                    due_ok = False
                    break
        if due_ok:
            tuntas += 1

    hipertensi_re = re.compile(r"(hipertensi|preeklams|pre-?eklams|darah tinggi)", re.I)
    dm_re = re.compile(r"(diabetes|kencing manis|\bdm\b)", re.I)
    penyakit = {"Hipertensi / Preeklamsia": 0, "Diabetes Melitus": 0, "Penyakit Lainnya": 0}
    penyulit_counter = {}
    for p in patients:
        s = (p.get("penyakit_penyerta") or "").strip()
        if s and s.lower() not in ("-", "tidak ada"):
            if hipertensi_re.search(s):
                penyakit["Hipertensi / Preeklamsia"] += 1
            elif dm_re.search(s):
                penyakit["Diabetes Melitus"] += 1
            else:
                penyakit["Penyakit Lainnya"] += 1
        for r in p.get("riwayat_kehamilan", []):
            v = (r.get("penyulit") or "").strip()
            if v and v not in ("Tidak ada", "Lainnya"):
                penyulit_counter[v] = penyulit_counter.get(v, 0) + 1
        mp = (p.get("masalah_persalinan") or "").strip()
        if mp:
            key = f"Persalinan: {mp}"
            penyulit_counter[key] = penyulit_counter.get(key, 0) + 1

    total = len(patients)
    penyakit_list = [{"nama": k, "jumlah": v, "persen": round(v / total * 100) if total else 0} for k, v in penyakit.items() if v > 0]
    penyulit_list = sorted(
        [{"nama": k, "jumlah": v, "persen": round(v / total * 100) if total else 0} for k, v in penyulit_counter.items()],
        key=lambda x: -x["jumlah"],
    )[:10]
    return {
        "total": total,
        "tuntas": tuntas,
        "tuntas_persen": round(tuntas / total * 100) if total else 0,
        "lost": lost,
        "lost_persen": round(lost / total * 100) if total else 0,
        "anc": anc_stats,
        "pnc": kf_stats,
        "penyakit": penyakit_list,
        "penyulit": penyulit_list,
    }


# ---------- IMUNISASI TT IBU HAMIL (jadwal Kemenkes) ----------
TT_SCHEDULE = [
    {"kode": "tt1", "nama": "TT 1", "dari": None, "interval_hari": 0, "ket": "kontak pertama / pendaftaran"},
    {"kode": "tt2", "nama": "TT 2", "dari": "tt1", "interval_hari": 28, "ket": "4 minggu setelah TT 1"},
    {"kode": "tt3", "nama": "TT 3", "dari": "tt2", "interval_hari": 182, "ket": "6 bulan setelah TT 2"},
    {"kode": "tt4", "nama": "TT 4", "dari": "tt3", "interval_hari": 365, "ket": "1 tahun setelah TT 3"},
    {"kode": "tt5", "nama": "TT 5", "dari": "tt4", "interval_hari": 365, "ket": "1 tahun setelah TT 4"},
]


@api_router.get("/patients/{patient_id}/imunisasi-tt")
async def get_imunisasi_tt(patient_id: str, user=Depends(get_current_user)):
    p = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")
    today = date.today()
    records = await db.imunisasi_tt.find({"patient_id": patient_id}, {"_id": 0}).to_list(20)
    done_map = {r["kode"]: r for r in records}
    daftar = date.fromisoformat(p["created_at"][:10]) if p.get("created_at") else today
    items = []
    for s in TT_SCHEDULE:
        rec = done_map.get(s["kode"])
        if s["dari"] is None:
            target = daftar
        else:
            prev = done_map.get(s["dari"])
            target = (date.fromisoformat(prev["tanggal"]) + timedelta(days=s["interval_hari"])) if prev else None
        if rec:
            status = "selesai"
        elif target is None:
            status = "menunggu"
        elif target < today - timedelta(days=7):
            status = "terlambat"
        elif target <= today:
            status = "hari_ini"
        elif (target - today).days <= 7:
            status = "mendekati"
        else:
            status = "terjadwal"
        items.append({**s, "tanggal_target": target.isoformat() if target else None, "status": status, "record": rec})
    return {"items": items}


@api_router.post("/patients/{patient_id}/imunisasi-tt")
async def add_imunisasi_tt(patient_id: str, data: ImunisasiInput, user=Depends(get_current_user)):
    p = await db.patients.find_one({"id": patient_id})
    if not p:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")
    sched = next((s for s in TT_SCHEDULE if s["kode"] == data.kode), None)
    if not sched:
        raise HTTPException(status_code=400, detail="Kode imunisasi TT tidak dikenal")
    existing = await db.imunisasi_tt.find_one({"patient_id": patient_id, "kode": data.kode})
    if existing:
        raise HTTPException(status_code=400, detail=f"{sched['nama']} sudah tercatat")
    tanggal = data.tanggal or date.today().isoformat()
    if parse_date(tanggal, "tanggal imunisasi") > date.today():
        raise HTTPException(status_code=400, detail="Tanggal imunisasi tidak boleh di masa depan")
    doc = {
        "id": str(uuid.uuid4()),
        "patient_id": patient_id,
        "kode": data.kode,
        "nama": sched["nama"],
        "tanggal": tanggal,
        "catatan": data.catatan or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.imunisasi_tt.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/imunisasi-tt/{record_id}")
async def delete_imunisasi_tt(record_id: str, user=Depends(get_current_user)):
    result = await db.imunisasi_tt.delete_one({"id": record_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Catatan imunisasi TT tidak ditemukan")
    return {"ok": True}


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


# ---------- PORTAL PASIEN ----------
def create_pasien_token(user_id: str) -> str:
    payload = {"sub": user_id, "role": "pasien", "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_pasien(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds:
        raise HTTPException(status_code=401, detail="Belum login")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Sesi tidak valid, silakan masuk kembali")
    if payload.get("role") != "pasien":
        raise HTTPException(status_code=403, detail="Akses khusus pasien")
    pu = await db.patient_users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not pu:
        raise HTTPException(status_code=401, detail="Akun tidak ditemukan")
    return pu


class PasienLoginInput(BaseModel):
    username: str
    password: str


class PasienProfilInput(BaseModel):
    golongan_darah: Optional[str] = ""
    nama_pendamping: Optional[str] = ""
    kontak_darurat: Optional[str] = ""
    faskes: Optional[str] = ""
    no_wa: Optional[str] = None


@api_router.post("/pasien/login")
async def pasien_login(data: PasienLoginInput):
    username = data.username.strip().lower()
    attempts = await db.login_attempts.find_one({"username": f"pasien:{username}"})
    if attempts and attempts.get("count", 0) >= 5:
        locked_until = attempts.get("locked_until")
        if locked_until and datetime.now(timezone.utc) < datetime.fromisoformat(locked_until):
            raise HTTPException(status_code=429, detail="Terlalu banyak percobaan login. Coba lagi dalam 15 menit.")
        await db.login_attempts.delete_one({"username": f"pasien:{username}"})
        attempts = None
    pu = await db.patient_users.find_one({"username": username})
    if not pu or not verify_password(data.password, pu["password_hash"]):
        new_count = (attempts.get("count", 0) if attempts else 0) + 1
        update = {"count": new_count}
        if new_count >= 5:
            update["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"username": f"pasien:{username}"}, {"$set": update}, upsert=True)
        raise HTTPException(status_code=401, detail="Username atau password salah")
    await db.login_attempts.delete_one({"username": f"pasien:{username}"})
    p = await db.patients.find_one({"id": pu["patient_id"]}, {"_id": 0, "nama": 1})
    return {"token": create_pasien_token(pu["id"]), "nama": p["nama"] if p else ""}


@api_router.post("/patients/{patient_id}/akun")
async def create_akun_pasien(patient_id: str, user=Depends(get_current_user)):
    p = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")
    slug = re.sub(r"[^a-z0-9]", "", p["nama"].lower())[:12] or "pasien"
    username = f"{slug}{secrets.randbelow(9000) + 1000}"
    while await db.patient_users.find_one({"username": username}):
        username = f"{slug}{secrets.randbelow(9000) + 1000}"
    password = secrets.token_urlsafe(6)
    await db.patient_users.update_one(
        {"patient_id": patient_id},
        {"$set": {"username": username, "password_hash": hash_password(password), "created_at": datetime.now(timezone.utc).isoformat()},
         "$setOnInsert": {"id": str(uuid.uuid4()), "patient_id": patient_id}},
        upsert=True,
    )
    return {"username": username, "password": password}


@api_router.get("/patients/{patient_id}/akun")
async def get_akun_pasien(patient_id: str, user=Depends(get_current_user)):
    pu = await db.patient_users.find_one({"patient_id": patient_id}, {"_id": 0, "password_hash": 0})
    if not pu:
        return {"ada": False}
    return {"ada": True, "username": pu["username"], "created_at": pu.get("created_at")}


@api_router.get("/pasien/me")
async def pasien_me(pu=Depends(get_current_pasien)):
    p = await db.patients.find_one({"id": pu["patient_id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    checks = await db.checkups.find({"patient_id": p["id"]}, {"_id": 0}).to_list(1000)
    checks.sort(key=lambda c: c["tanggal"])
    imu = await db.imunisasi.find({"patient_id": p["id"]}, {"_id": 0}).to_list(100)
    return {"pasien": serialize_patient(p, checks, imu), "timeline": build_timeline(p, checks), "checkups": checks}


@api_router.put("/pasien/profil")
async def pasien_profil(data: PasienProfilInput, pu=Depends(get_current_pasien)):
    update = {
        "golongan_darah": data.golongan_darah or "",
        "nama_pendamping": data.nama_pendamping or "",
        "kontak_darurat": data.kontak_darurat or "",
        "faskes": data.faskes or "",
        "profil_lengkap": True,
    }
    if data.no_wa:
        update["no_wa"] = data.no_wa
    await db.patients.update_one({"id": pu["patient_id"]}, {"$set": update})
    return {"ok": True}


class PemantauanInput(BaseModel):
    kondisi: str
    demam: str = "Tidak"
    suhu: Optional[float] = None
    demam_hari: Optional[int] = None
    sakit_kepala: str = "Tidak"
    nyeri_perut: str = "Tidak"
    perdarahan: str = "Tidak"
    cairan: str = "Tidak"
    cairan_banyak: str = "Tidak"
    sakit_bak: str = "Tidak"
    keputihan: str = "Tidak"
    mual: str = "Tidak"
    mual_tingkat: Optional[str] = None
    diare: str = "Tidak"
    sesak: str = "Tidak"
    emosional: str = "Biasa saja"
    sulit_tidur: str = "Tidak"
    keluhan_lain: Optional[str] = ""


DANGER_LABELS = {
    "demam": "Demam", "sakit_kepala": "Sakit kepala/pusing berat", "nyeri_perut": "Nyeri perut hebat",
    "perdarahan": "Perdarahan dari jalan lahir", "cairan_banyak": "Cairan jalan lahir banyak/berbau",
    "diare": "Diare berulang", "sesak": "Sesak napas/jantung berdebar",
}


@api_router.post("/pasien/pemantauan")
async def add_pemantauan(data: PemantauanInput, pu=Depends(get_current_pasien)):
    tanggal = date.today().isoformat()
    bahaya = [label for k, label in DANGER_LABELS.items() if getattr(data, k, "Tidak") == "Ya"]
    doc = data.model_dump()
    doc.update({"patient_id": pu["patient_id"], "tanggal": tanggal, "tanda_bahaya": bahaya, "created_at": datetime.now(timezone.utc).isoformat()})
    await db.pemantauan_harian.update_one({"patient_id": pu["patient_id"], "tanggal": tanggal}, {"$set": doc}, upsert=True)
    return {"ok": True, "tanda_bahaya": bahaya}


@api_router.get("/pasien/pemantauan")
async def get_pemantauan(limit: int = 30, pu=Depends(get_current_pasien)):
    docs = await db.pemantauan_harian.find({"patient_id": pu["patient_id"]}, {"_id": 0}).sort("tanggal", -1).to_list(limit)
    return docs


class MingguanInput(BaseModel):
    minggu_ke: int
    jawaban: dict


@api_router.post("/pasien/mingguan")
async def add_mingguan(data: MingguanInput, pu=Depends(get_current_pasien)):
    bahaya = [k for k, v in data.jawaban.items() if v]
    doc = {"patient_id": pu["patient_id"], "minggu_ke": data.minggu_ke, "jawaban": data.jawaban, "ada_bahaya": len(bahaya) > 0, "tanggal": date.today().isoformat(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.pemantauan_mingguan.update_one({"patient_id": pu["patient_id"], "minggu_ke": data.minggu_ke}, {"$set": doc}, upsert=True)
    return {"ok": True, "ada_bahaya": len(bahaya) > 0}


@api_router.get("/pasien/mingguan")
async def get_mingguan(pu=Depends(get_current_pasien)):
    return await db.pemantauan_mingguan.find({"patient_id": pu["patient_id"]}, {"_id": 0}).sort("minggu_ke", -1).to_list(50)


class TtdInput(BaseModel):
    tanggal: Optional[str] = None
    status: str  # "sudah" | "tidak"
    alasan: Optional[str] = ""


@api_router.post("/pasien/ttd")
async def add_ttd(data: TtdInput, pu=Depends(get_current_pasien)):
    if data.status not in ("sudah", "tidak"):
        raise HTTPException(status_code=400, detail="Status tidak valid")
    tanggal = data.tanggal or date.today().isoformat()
    parse_date(tanggal, "tanggal")
    await db.ttd.update_one(
        {"patient_id": pu["patient_id"], "tanggal": tanggal},
        {"$set": {"patient_id": pu["patient_id"], "tanggal": tanggal, "status": data.status, "alasan": data.alasan or "", "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True}


@api_router.get("/pasien/ttd")
async def get_ttd(pu=Depends(get_current_pasien)):
    return await db.ttd.find({"patient_id": pu["patient_id"]}, {"_id": 0}).sort("tanggal", -1).to_list(400)


@api_router.post("/pasien/gerakan")
async def add_gerakan(pu=Depends(get_current_pasien)):
    tanggal = date.today().isoformat()
    await db.gerakan.update_one(
        {"patient_id": pu["patient_id"], "tanggal": tanggal},
        {"$inc": {"jumlah": 1}, "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    doc = await db.gerakan.find_one({"patient_id": pu["patient_id"], "tanggal": tanggal}, {"_id": 0})
    return doc


@api_router.get("/pasien/gerakan")
async def get_gerakan(pu=Depends(get_current_pasien)):
    return await db.gerakan.find({"patient_id": pu["patient_id"]}, {"_id": 0}).sort("tanggal", -1).to_list(60)


class ItemsInput(BaseModel):
    items: dict


@api_router.get("/pasien/persiapan")
async def get_persiapan(pu=Depends(get_current_pasien)):
    doc = await db.persiapan.find_one({"patient_id": pu["patient_id"]}, {"_id": 0})
    return {"items": doc["items"] if doc else {}}


@api_router.put("/pasien/persiapan")
async def put_persiapan(data: ItemsInput, pu=Depends(get_current_pasien)):
    await db.persiapan.update_one({"patient_id": pu["patient_id"]}, {"$set": {"items": data.items}}, upsert=True)
    return {"ok": True}


PENGINGAT_DEFAULT = {"ttd": True, "harian": True, "gerakan": True, "kontrol": True, "edukasi": True}


@api_router.get("/pasien/pengingat")
async def get_pengingat(pu=Depends(get_current_pasien)):
    doc = await db.pengingat.find_one({"patient_id": pu["patient_id"]}, {"_id": 0})
    return doc["settings"] if doc else PENGINGAT_DEFAULT


@api_router.put("/pasien/pengingat")
async def put_pengingat(data: ItemsInput, pu=Depends(get_current_pasien)):
    await db.pengingat.update_one({"patient_id": pu["patient_id"]}, {"$set": {"settings": data.items}}, upsert=True)
    return {"ok": True}


@api_router.get("/pasien/edukasi-klinik")
async def pasien_edukasi_klinik(pu=Depends(get_current_pasien)):
    p = await db.patients.find_one({"id": pu["patient_id"]}, {"_id": 0})
    checks = await db.checkups.find({"patient_id": pu["patient_id"]}, {"_id": 0}).to_list(1000)
    fase = compute_status(p, checks)["fase"]
    msgs = await db.edukasi.find({"fase": fase}, {"_id": 0}).sort("created_at", 1).to_list(50)
    return {"fase": fase, "pesan": msgs}


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
    await db.imunisasi.create_index("patient_id")
    await db.imunisasi_tt.create_index("patient_id")
    await db.patient_users.create_index("username", unique=True)
    await db.pemantauan_harian.create_index([("patient_id", 1), ("tanggal", 1)], unique=True)
    await db.ttd.create_index([("patient_id", 1), ("tanggal", 1)], unique=True)
    await db.gerakan.create_index([("patient_id", 1), ("tanggal", 1)], unique=True)
    await db.login_attempts.create_index("username", unique=True)
    username = os.environ.get("ADMIN_USERNAME", "admin").lower()
    password = os.environ["ADMIN_PASSWORD"]
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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
