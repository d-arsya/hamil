# PRD — BidanKu (Sistem Monitoring Ibu Hamil & Nifas)

## Problem Statement (asli)
User meminta website monitoring ibu hamil dari awal menjadi pasien sampai masa nifas untuk rutin kontrol. Data pasien disimpan beserta nomor WA; website bisa kirim pesan pengingat WA saat waktunya kontrol (diputuskan: link wa.me + template pesan yang bisa di-copy, bukan API); ada status kapan seharusnya kontrol dan status sudah/belum kontrol.

## Pilihan User
1. WhatsApp via link wa.me dengan template pesan copy-paste (tanpa API key)
2. Login username + password (tanpa email)
3. Data tambahan: riwayat kehamilan (G/P/A), tekanan darah, berat badan per kontrol
4. UI Bahasa Indonesia

## User Personas
- Bidan / petugas puskesmas (admin tunggal) — mengelola pasien, mencatat kontrol, mengirim pengingat WA

## Arsitektur
- Backend: FastAPI + MongoDB (motor), JWT Bearer auth (bcrypt), prefix /api
- Frontend: React + Tailwind + Recharts + Sonner, token di localStorage
- Jadwal otomatis: ANC 6x (minggu ke-12/16/26/32/36/39 dari HPHT), Nifas KF1-KF4 (hari ke-2/7/14/42 dari persalinan), HPL = HPHT + 280 hari
- Status kontrol: terlambat / hari_ini / mendekati / terjadwal / sudah_kontrol / selesai (dihitung per fase aktif)

## Sudah Diimplementasikan (Sept 2026)
- Login JWT username/password + lockout brute-force (5x gagal → 429, 15 menit), seed admin (admin/admin123, email dava.adila12@gmail.com)
- CRUD pasien lengkap + validasi tanggal (HPHT tidak masa depan, persalinan >= HPHT, format ISO, G/P/A valid)
- Dashboard: statistik + daftar "Perlu Tindakan" (terlambat/hari ini/mendekati)
- Daftar pasien: search nama/WA (normalisasi 0/62/+62), filter status & fase
- Detail pasien: grafik TD & BB (Recharts), riwayat kontrol, catat kontrol (ANC otomatis K1-K6 / nifas KF1-KF4), tandai persalinan
- Modal pengingat WA: 3 template (rutin/terlambat/nifas), edit pesan, salin ke clipboard (dengan fallback), tombol buka wa.me
- 44/44 test backend pass, 100% flow frontend terverifikasi (2 iterasi testing agent)

## Iterasi 2 (Sept 2026)
- Kupon Pijat Bayi Gratis 1x: otomatis eligible jika kontrol ANC > 5x, banner di detail pasien + badge di daftar, tombol klaim/batal (PUT /api/patients/{id}/kupon)
- Identitas pasien baru: tanggal lahir (usia dihitung otomatis), penyakit penyerta, keluhan utama
- Menu Edukasi (/edukasi): chatbox per fase (Trimester 1-4, Masa Nifas), bidan menulis/menghapus materi edukasi (GET/POST/DELETE /api/edukasi)
- Testing iterasi 3: 54/54 backend pass, 100% frontend pass

## Backlog
- P1: Pengingat WA otomatis terjadwal (cron harian + integrasi API WhatsApp seperti Fonnte)
- P1: Multi-user (banyak bidan, role admin/staf)
- P2: Cetak/ekspor kartu monitoring (PDF), impor data pasien (CSV)
- P2: Pindahkan JWT ke httpOnly cookie; CORS origins eksplisit; agregasi query (hapus N+1)
- P2: Notifikasi lewat HPL (flag `lewat_hpl` sudah ada di backend, belum ditampilkan di UI)
