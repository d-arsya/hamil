# Perubahan 13 Oktober 2026 — BidanKu

Dokumen ini merangkum seluruh perubahan yang dilakukan pada **13 Oktober 2026** (3 commit: merge remote, checkpoint, dan iterasi 17).

## 1. Merge Perubahan dari Git Remote (Anda)

Perubahan yang Anda push berhasil digabung tanpa konflik:

| File | Perubahan |
|---|---|
| `frontend/src/setupProxy.js` | **BARU** — proxy lokal `/api` → backend saat development |
| `frontend/vercel.json` | **BARU** — rewrite `/api/*` ke backend + fallback SPA untuk deployment Vercel |
| `frontend/src/lib/api.js` & `pasienApi.js` | Dukungan baseURL relatif (dipakai saat deploy di domain yang sama) |
| `backend/server.py` | Cookie auth: `samesite="lax"` → `samesite="none"` (agar cookie lintas-domain bekerja di Vercel) |
| `backend/requirements.txt` | Hapus `emergentintegrations` (tidak dipakai) |

## 2. Fitur Baru (Iterasi 17)

### a. Nomor BPJS (opsional)
- Field `no_bpjs` di data pasien, posisi setelah **No. Rekam Medis**. Keduanya opsional.
- Lokasi: `backend/server.py` (model `PatientInput` + serializer), `frontend/src/components/PatientForm.jsx` (testid `patient-form-no-bpjs`), `frontend/src/pages/PatientDetail.jsx` (InfoItem "No. BPJS").

### b. LiLa dihapus dari Catat Kontrol
- Field Lingkar Lengan Atas (LiLa) **dihapus dari form** pencatatan kontrol.
- Data historis tetap tersimpan dan tetap tampil di riwayat kontrol & portal pasien.

### c. PNC — Pemeriksaan Fisik Bayi
Saat catat kontrol jenis **PNC (nifas)**, ada seksi baru "Pemeriksaan Fisik Bayi":
- Berat badan (gram), Panjang badan (cm), Lingkar kepala (cm), Suhu bayi (°C)
- Tali pusat (Bersih & kering / Lembab / Terlepas / Tanda infeksi)
- Ikterus / kuning (Tidak / Ya)
- Field backend: `bayi_bb`, `bayi_pb`, `bayi_lk`, `bayi_suhu`, `bayi_tali_pusat`, `bayi_ikterus`

### d. Ceklis Kunjungan Sebelumnya (Tanpa Data)
- Di form catat kontrol ada chips **"Tandai kunjungan lain yang sudah dilakukan"** (K1–K6 untuk ANC, KF1–KF4 untuk PNC).
- Berguna untuk pasien pindahan: kunjungan yang sudah dilakukan di tempat lain bisa diceklis walau tanpa data pemeriksaan; tercatat dengan catatan *"Ditandai manual — tanpa data pemeriksaan"*.
- Kunjungan yang sudah tercatat otomatis disembunyikan dari chips.

### e. ANC — Detail Bayi (hasil pemeriksaan/USG)
Seksi baru "Detail Bayi" pada kontrol ANC:
- DJJ (x/menit), Letak Plasenta, Air Ketuban (Cukup/Kurang/Lebih), TBJ (gram)
- Jumlah Janin (Tunggal/Lebih dari satu), Keadaan Janin (Hidup/Mati)
- Lokasi (Intrauterine/Ekstrauterine), Presentasi (Kepala/Bokong/Lintang/Oblique), Jenis Kelamin
- Field backend: `djj` (sudah ada), `letak_plasenta`, `ketuban`, `tbj`, `jumlah_janin`, `keadaan_janin`, `lokasi_kehamilan`, `presentasi`, `jk_janin`

### f. Edit Riwayat Kontrol
- Endpoint baru: **`PUT /api/checkups/{checkup_id}`**
  - Semua kolom pemeriksaan bisa diedit; `jenis` dan `ke` (nomor kunjungan) **terkunci** agar status kontrol tidak rusak.
  - Tanggal tidak boleh di masa depan (400), id tidak ada (404), tanpa login (401).
- UI: tombol pensil per baris di tabel riwayat kontrol (detail pasien) — form terbuka terisi data lama.

### g. Resume Kontrol → PDF
- Tombol dokumen (📄) per baris kontrol di detail pasien.
- Membuka jendela print berisi resume: identitas pasien (nama, RM, BPJS, HPHT/HPL, GPA, penyakit penyerta), data kunjungan + TTV, detail bayi ANC / fisik bayi PNC, keluhan, catatan, rencana tindak lanjut, tanda tangan bidan.
- Pilih **"Save as PDF"** di dialog print untuk mengunduh.
- Implementasi: `frontend/src/lib/resume.js` (`cetakResumeKontrol`) — tanpa dependency backend baru.

## 3. Perbaikan Bug (ditemukan saat testing)

| Bug | Akar Masalah | Perbaikan |
|---|---|---|
| Dashboard & Laporan error 500 | Edit kontrol dengan body parsial men-set `tanggal` jadi `null` → `compute_status` crash | `PUT /api/checkups` kini hanya mengubah `tanggal` bila dikirim; data terdampak diperbaiki |
| Test flaky: akun pasien terkunci/terhapus saat test paralel | Teardown test portal menghapus SEMUA pasien `TEST_portal_*` (milik worker lain ikut terhapus); test login salah menumpuk attempts | Teardown hanya menghapus pasien milik modulnya; tambah `clear_pasien_attempts()` per akun |
| Test flaky: hitungan laporan global berubah saat paralel | Assertion `==` pada count global | Dilonggarkan menjadi `>=` |

## 4. Hasil Pengujian

- **Full backend suite: 163/163 test pass** (termasuk 9 test baru `tests/test_iterasi17_fitur.py`)
- Testing agent (frontend + backend): semua fitur iterasi 17 diverifikasi 100% — form, ceklis kunjungan, edit kontrol, tombol resume, field BPJS.
