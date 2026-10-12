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
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
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

CLINIC_COOKIE = "bidanku_token"
PASIEN_COOKIE = "bidanku_pasien"


def set_auth_cookie(response: Response, name: str, token: str, max_age: int):
    response.set_cookie(name, token, httponly=True, secure=True, samesite="lax", max_age=max_age, path="/")

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


async def get_current_user(request: Request, creds: HTTPAuthorizationCredentials = Depends(security)):
    token = creds.credentials if creds else request.cookies.get(CLINIC_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Belum login")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
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


def _jadwal_berikutnya(done_set: set, targets: list, base: date, satuan: str, prev_ke_base: bool = False):
    """Kembalikan (tanggal_kunjungan_berikutnya, tanggal_awal_periode, label kunjungan)."""
    step = timedelta(weeks=1) if satuan == "minggu" else timedelta(days=1)
    next_idx = next((i for i in range(len(targets)) if (i + 1) not in done_set), None)
    if next_idx is None:
        return None, base + step * targets[-1], None
    next_date = base + step * targets[next_idx]
    if next_idx > 0:
        prev_date = base + step * targets[next_idx - 1]
    else:
        prev_date = base if prev_ke_base else None
    prefix = "K" if satuan == "minggu" else "KF"
    return next_date, prev_date, f"{prefix}{next_idx + 1}"


def compute_status(pasien: dict, checkups: list, today: Optional[date] = None) -> dict:
    today = today or date.today()
    hpht = date.fromisoformat(pasien["hpht"])
    hpl = hpht + timedelta(days=280)
    persalinan = date.fromisoformat(pasien["tanggal_persalinan"]) if pasien.get("tanggal_persalinan") else None

    usia_minggu = usia_hari = hari_nifas = None
    if persalinan:
        fase = "nifas"
        hari_nifas = (today - persalinan).days
        phase_checks = [c for c in checkups if c.get("jenis") == "kf"]
        done_set = {c.get("ke") for c in phase_checks if c.get("ke")}
        next_date, prev_date, kunjungan = _jadwal_berikutnya(done_set, KF_DAYS, persalinan, "hari", prev_ke_base=True)
        fase_ke, fase_total = min(len(done_set), len(KF_DAYS)), len(KF_DAYS)
    else:
        selisih = (today - hpht).days
        usia_minggu, usia_hari = selisih // 7, selisih % 7
        fase = "trimester_1" if usia_minggu < 13 else ("trimester_2" if usia_minggu < 28 else "trimester_3")
        phase_checks = [c for c in checkups if c.get("jenis") == "anc"]
        done_set = {c.get("ke") for c in phase_checks if c.get("ke")}
        next_date, prev_date, kunjungan = _jadwal_berikutnya(done_set, ANC_WEEKS, hpht, "minggu")
        target = {"trimester_1": {1, 2}, "trimester_2": {3}, "trimester_3": {4, 5, 6}}[fase]
        fase_ke, fase_total = len(done_set & target), len(target)

    last = max((date.fromisoformat(c["tanggal"]) for c in phase_checks), default=None)
    selisih_hari = (next_date - today).days if next_date else None

    if next_date is None:
        status = "selesai"
    elif last and prev_date and last >= prev_date:
        status = "sudah_kontrol"
    elif next_date < today:
        status = "terlambat"
    elif next_date == today:
        status = "hari_ini"
    elif selisih_hari <= 7:
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
async def login(data: LoginInput, response: Response):
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
    set_auth_cookie(response, CLINIC_COOKIE, token, 12 * 3600)
    return {"token": token, "user": {"username": user["username"], "nama": user.get("nama", ""), "email": user.get("email", "")}}


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(CLINIC_COOKIE, path="/")
    return {"ok": True}


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


class NewUserInput(BaseModel):
    username: str
    nama: str
    password: str


@api_router.get("/auth/users")
async def list_users(user=Depends(get_current_user)):
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", 1).to_list(200)


@api_router.post("/auth/users")
async def add_user(data: NewUserInput, user=Depends(get_current_user)):
    username = data.username.strip().lower()
    if not re.fullmatch(r"[a-z0-9_.]{3,30}", username):
        raise HTTPException(status_code=400, detail="Username 3-30 karakter, hanya huruf kecil, angka, titik, atau underscore")
    if not data.nama.strip():
        raise HTTPException(status_code=400, detail="Nama wajib diisi")
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password minimal 8 karakter")
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username sudah dipakai")
    doc = {
        "id": str(uuid.uuid4()),
        "username": username,
        "nama": data.nama.strip(),
        "email": "",
        "role": "admin",
        "password_hash": hash_password(data.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


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
    pantau_docs = await db.pemantauan_harian.find(
        {}, {"_id": 0, "patient_id": 1, "tanggal": 1, "tanda_bahaya": 1, "kondisi": 1}
    ).sort("tanggal", -1).to_list(50000)
    latest_pantau = {}
    for d in pantau_docs:
        latest_pantau.setdefault(d["patient_id"], d)
    today = date.today()
    serialized = []
    for p in patients:
        s = await patient_with_checkups(p)
        lp = latest_pantau.get(p["id"])
        if lp and (today - date.fromisoformat(lp["tanggal"])).days <= 7:
            s["pantau"] = {"tanggal": lp["tanggal"], "bahaya": lp.get("tanda_bahaya", []), "kondisi": lp.get("kondisi", "")}
        serialized.append(s)
    return sorted(serialized, key=lambda p: (p["jadwal_berikutnya"] is None, p["jadwal_berikutnya"] or "9999"))


@api_router.get("/patients/{patient_id}/pemantauan")
async def get_pemantauan_pasien(patient_id: str, user=Depends(get_current_user)):
    if not await db.patients.find_one({"id": patient_id}):
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")
    harian = await db.pemantauan_harian.find({"patient_id": patient_id}, {"_id": 0}).sort("tanggal", -1).to_list(14)
    mingguan = await db.pemantauan_mingguan.find({"patient_id": patient_id}, {"_id": 0}).sort("minggu_ke", -1).to_list(12)
    ttd = await db.ttd.find({"patient_id": patient_id}, {"_id": 0}).sort("tanggal", -1).to_list(30)
    gerakan = await db.gerakan.find({"patient_id": patient_id}, {"_id": 0}).sort("tanggal", -1).to_list(14)
    return {"harian": harian, "mingguan": mingguan, "ttd": ttd, "gerakan": gerakan}


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
    await db.followup_log.delete_many({"patient_id": patient_id})
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


# ---------- PENGATURAN KLINIK ----------
BULAN_ID = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

TEMPLATE_JANJI_DEFAULT = "Halo Bidan, saya {nama}. Saya ingin membuat janji temu untuk kontrol {kunjungan} pada {jadwal}. Mohon info waktu yang tersedia. Terima kasih."
TEMPLATE_FOLLOWUP_DEFAULT = "Halo Ibu {nama}, salam sehat! Pengingat mingguan: jadwal kontrol Ibu berikutnya adalah {kunjungan} pada {jadwal}. Jangan lupa datang dan tetap rutin minum TTD ya, Bu. — {bidan}"


def fmt_tgl(iso: Optional[str]) -> str:
    if not iso:
        return "-"
    d = date.fromisoformat(iso)
    return f"{d.day} {BULAN_ID[d.month]} {d.year}"


def render_template(text: str, p: dict, st: dict, bidan: str = "") -> str:
    return (
        text.replace("{nama}", p["nama"])
        .replace("{kunjungan}", st.get("kunjungan_berikutnya") or "kontrol")
        .replace("{jadwal}", fmt_tgl(st.get("jadwal_berikutnya")))
        .replace("{bidan}", bidan)
    )


async def get_pengaturan_doc() -> dict:
    doc = await db.pengaturan.find_one({"id": "klinik"}, {"_id": 0})
    doc = doc or {}
    return {
        "wa_bidan": doc.get("wa_bidan", ""),
        "template_janji": doc.get("template_janji") or TEMPLATE_JANJI_DEFAULT,
        "template_followup": doc.get("template_followup") or TEMPLATE_FOLLOWUP_DEFAULT,
    }


class PengaturanInput(BaseModel):
    wa_bidan: Optional[str] = ""
    template_janji: Optional[str] = ""
    template_followup: Optional[str] = ""


@api_router.get("/pengaturan")
async def get_pengaturan(user=Depends(get_current_user)):
    return await get_pengaturan_doc()


@api_router.put("/pengaturan")
async def put_pengaturan(data: PengaturanInput, user=Depends(get_current_user)):
    wa = re.sub(r"\D", "", data.wa_bidan or "")
    if wa.startswith("0"):
        wa = "62" + wa[1:]
    if wa and len(wa) < 9:
        raise HTTPException(status_code=400, detail="Nomor WhatsApp tidak valid")
    if data.template_janji and len(data.template_janji) > 2000:
        raise HTTPException(status_code=400, detail="Template janji temu maksimal 2000 karakter")
    if data.template_followup and len(data.template_followup) > 2000:
        raise HTTPException(status_code=400, detail="Template follow-up maksimal 2000 karakter")
    await db.pengaturan.update_one(
        {"id": "klinik"},
        {"$set": {
            "wa_bidan": wa,
            "template_janji": (data.template_janji or "").strip(),
            "template_followup": (data.template_followup or "").strip(),
        }},
        upsert=True,
    )
    return await get_pengaturan_doc()


# ---------- LAPORAN ----------
def _done_ke(checks: list, jenis: str, ke: int) -> bool:
    return any(c.get("jenis") == jenis and c.get("ke") == ke for c in checks)


def _ketuntasan_kunjungan(patients: list, by_patient: dict, today: date, jenis: str) -> list:
    if jenis == "kf":
        targets, prefix, satuan = KF_DAYS, "KF", "hari"
    else:
        targets, prefix, satuan = ANC_WEEKS, "K", "mgg"
    stats = []
    for i, t in enumerate(targets):
        eligible = done = 0
        for p in patients:
            if jenis == "kf":
                if not p.get("tanggal_persalinan"):
                    continue
                jatuh_tempo = date.fromisoformat(p["tanggal_persalinan"]) + timedelta(days=t) <= today
            else:
                jatuh_tempo = date.fromisoformat(p["hpht"]) + timedelta(weeks=t) <= today or bool(p.get("tanggal_persalinan"))
            if jatuh_tempo:
                eligible += 1
                if _done_ke(by_patient.get(p["id"], []), jenis, i + 1):
                    done += 1
        stats.append({
            "kode": f"{prefix}{i + 1}",
            "label": f"{prefix}{i + 1} ({satuan} {t})",
            "eligible": eligible,
            "done": done,
            "persen": round(done / eligible * 100) if eligible else None,
        })
    return stats


def _evaluasi_pasien(p: dict, checks: list, today: date) -> dict:
    """Evaluasi satu pasien: lost to follow up, tuntas, perlu follow-up kontrol, perlu update data."""
    st = compute_status(p, checks, today)
    followup = None
    if st["status"] in ("terlambat", "hari_ini", "mendekati"):
        followup = {
            "id": p["id"], "nama": p["nama"], "status": st["status"],
            "jadwal_berikutnya": st["jadwal_berikutnya"], "selisih_hari": st["selisih_hari"],
            "kunjungan_berikutnya": st["kunjungan_berikutnya"],
        }
    alasan = []
    if not (p.get("no_rm") or "").strip() or not p.get("tanggal_lahir") or not (p.get("alamat") or "").strip():
        alasan.append("Data identitas belum lengkap (No. RM / tgl lahir / alamat)")
    if st["status"] != "selesai":
        if st["kontrol_terakhir"]:
            if (today - date.fromisoformat(st["kontrol_terakhir"])).days > 30:
                alasan.append("Sudah lebih dari 30 hari tidak kontrol")
        elif p.get("created_at") and (today - date.fromisoformat(p["created_at"][:10])).days > 30:
            alasan.append("Belum pernah kontrol sejak terdaftar lebih dari 30 hari")
    lost = st["status"] == "terlambat"
    tuntas = False
    if not lost:
        if not p.get("tanggal_persalinan"):
            jadwal = [(i + 1, date.fromisoformat(p["hpht"]) + timedelta(weeks=w)) for i, w in enumerate(ANC_WEEKS)]
            jenis = "anc"
        else:
            jadwal = [(i + 1, date.fromisoformat(p["tanggal_persalinan"]) + timedelta(days=d)) for i, d in enumerate(KF_DAYS)]
            jenis = "kf"
        tuntas = all(tgl > today or _done_ke(checks, jenis, ke) for ke, tgl in jadwal)
    return {
        "lost": lost,
        "tuntas": tuntas,
        "followup": followup,
        "update": {"id": p["id"], "nama": p["nama"], "alasan": alasan} if alasan else None,
    }


def _profil_risiko(patients: list, total: int) -> tuple:
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
    penyakit_list = [{"nama": k, "jumlah": v, "persen": round(v / total * 100) if total else 0} for k, v in penyakit.items() if v > 0]
    penyulit_list = sorted(
        [{"nama": k, "jumlah": v, "persen": round(v / total * 100) if total else 0} for k, v in penyulit_counter.items()],
        key=lambda x: -x["jumlah"],
    )[:10]
    return penyakit_list, penyulit_list


@api_router.get("/laporan")
async def laporan(user=Depends(get_current_user)):
    patients = await db.patients.find({}, {"_id": 0}).to_list(5000)
    checks = await db.checkups.find({}, {"_id": 0}).to_list(50000)
    by_patient = {}
    for c in checks:
        by_patient.setdefault(c["patient_id"], []).append(c)
    today = date.today()
    anc_stats = _ketuntasan_kunjungan(patients, by_patient, today, "anc")
    kf_stats = _ketuntasan_kunjungan(patients, by_patient, today, "kf")

    tuntas = lost = 0
    perlu_followup_list = []
    perlu_update_list = []
    for p in patients:
        hasil = _evaluasi_pasien(p, by_patient.get(p["id"], []), today)
        if hasil["lost"]:
            lost += 1
        if hasil["tuntas"]:
            tuntas += 1
        if hasil["followup"]:
            perlu_followup_list.append(hasil["followup"])
        if hasil["update"]:
            perlu_update_list.append(hasil["update"])

    total = len(patients)
    penyakit_list, penyulit_list = _profil_risiko(patients, total)
    perlu_followup_list.sort(key=lambda x: (x["selisih_hari"] is None, x["selisih_hari"] if x["selisih_hari"] is not None else 0))

    return {
        "total": total,
        "tuntas": tuntas,
        "tuntas_persen": round(tuntas / total * 100) if total else 0,
        "lost": lost,
        "lost_persen": round(lost / total * 100) if total else 0,
        "perlu_followup": len(perlu_followup_list),
        "perlu_followup_list": perlu_followup_list,
        "perlu_update": len(perlu_update_list),
        "perlu_update_list": perlu_update_list,
        "anc": anc_stats,
        "pnc": kf_stats,
        "penyakit": penyakit_list,
        "penyulit": penyulit_list,
    }


# ---------- FOLLOW-UP MINGGUAN ----------
def iso_week(d: date) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


@api_router.get("/followup")
async def get_followup(user=Depends(get_current_user)):
    today = date.today()
    minggu = iso_week(today)
    patients = await db.patients.find({}, {"_id": 0}).to_list(5000)
    checks = await db.checkups.find({}, {"_id": 0}).to_list(50000)
    by_patient = {}
    for c in checks:
        by_patient.setdefault(c["patient_id"], []).append(c)
    logs = await db.followup_log.find({"minggu": minggu}, {"_id": 0}).to_list(5000)
    done_map = {l["patient_id"]: l for l in logs}
    pengaturan = await get_pengaturan_doc()
    items = []
    for p in patients:
        st = compute_status(p, by_patient.get(p["id"], []), today)
        if st["status"] == "selesai":
            continue
        log = done_map.get(p["id"])
        items.append({
            "id": p["id"],
            "nama": p["nama"],
            "no_wa": p["no_wa"],
            "fase": st["fase"],
            "status": st["status"],
            "jadwal_berikutnya": st["jadwal_berikutnya"],
            "kunjungan_berikutnya": st["kunjungan_berikutnya"],
            "selisih_hari": st["selisih_hari"],
            "prioritas": st["status"] in ("terlambat", "hari_ini", "mendekati"),
            "sudah_followup": log is not None,
            "followup_at": log.get("tanggal") if log else None,
        })
    items.sort(key=lambda x: (x["sudah_followup"], not x["prioritas"], x["jadwal_berikutnya"] or "9999"))
    return {"minggu": minggu, "template": pengaturan["template_followup"], "items": items}


@api_router.post("/followup/{patient_id}")
async def mark_followup(patient_id: str, user=Depends(get_current_user)):
    if not await db.patients.find_one({"id": patient_id}):
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")
    minggu = iso_week(date.today())
    await db.followup_log.update_one(
        {"patient_id": patient_id, "minggu": minggu},
        {"$set": {
            "patient_id": patient_id,
            "minggu": minggu,
            "tanggal": datetime.now(timezone.utc).isoformat(),
            "oleh": user.get("nama") or user.get("username", ""),
        }},
        upsert=True,
    )
    return {"ok": True, "minggu": minggu}


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


async def get_current_pasien(request: Request, creds: HTTPAuthorizationCredentials = Depends(security)):
    token = creds.credentials if creds else request.cookies.get(PASIEN_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Belum login")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
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
async def pasien_login(data: PasienLoginInput, response: Response):
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
    token = create_pasien_token(pu["id"])
    set_auth_cookie(response, PASIEN_COOKIE, token, 30 * 24 * 3600)
    return {"token": token, "nama": p["nama"] if p else ""}


@api_router.post("/pasien/logout")
async def pasien_logout(response: Response):
    response.delete_cookie(PASIEN_COOKIE, path="/")
    return {"ok": True}


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
    tgl = parse_date(tanggal, "tanggal")
    if tgl > date.today():
        raise HTTPException(status_code=400, detail="Tanggal tidak boleh di masa depan")
    if tgl < date.today() and not (data.alasan or "").strip():
        raise HTTPException(status_code=400, detail="Untuk tanggal yang sudah lewat, wajib isi alasan kenapa terlewat")
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


@api_router.get("/pasien/ttv")
async def pasien_ttv(pu=Depends(get_current_pasien)):
    checks = await db.checkups.find({"patient_id": pu["patient_id"]}, {"_id": 0}).sort("tanggal", -1).to_list(20)
    return [
        {
            "tanggal": c["tanggal"],
            "jenis": c.get("jenis"),
            "ke": c.get("ke"),
            "berat_badan": c.get("berat_badan"),
            "sistolik": c.get("sistolik"),
            "diastolik": c.get("diastolik"),
            "tfu": c.get("tfu"),
            "suhu": c.get("suhu"),
            "nadi": c.get("nadi"),
            "rr": c.get("rr"),
            "spo2": c.get("spo2"),
            "lila": c.get("lila"),
            "tinggi_badan": c.get("tinggi_badan"),
        }
        for c in checks
    ]


@api_router.get("/pasien/janji")
async def pasien_janji(pu=Depends(get_current_pasien)):
    p = await db.patients.find_one({"id": pu["patient_id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    checks = await db.checkups.find({"patient_id": pu["patient_id"]}, {"_id": 0}).to_list(1000)
    st = compute_status(p, checks)
    pengaturan = await get_pengaturan_doc()
    return {
        "wa_bidan": pengaturan["wa_bidan"],
        "pesan": render_template(pengaturan["template_janji"], p, st) if pengaturan["wa_bidan"] else "",
        "jadwal_berikutnya": st["jadwal_berikutnya"],
        "kunjungan_berikutnya": st["kunjungan_berikutnya"],
        "status": st["status"],
        "selisih_hari": st["selisih_hari"],
    }


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
    await db.followup_log.create_index([("patient_id", 1), ("minggu", 1)], unique=True)
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
