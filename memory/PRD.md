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

## Iterasi 3 (Sept 2026)
- Kirim Edukasi ke WA: tombol "Kirim ke WA Pasien" di tiap tab edukasi — modal menyiapkan pesan gabungan dari chatbox fase tsb (bisa diedit/disalin) + daftar pasien penerima otomatis sesuai fase (T1/T2/T3 → fase trimester terkait, Masa Nifas → nifas ≤42 hari, Trimester 4 → nifas >42 hari), tinggal klik "Kirim WA" per pasien (wa.me pre-filled). Komponen: EdukasiBlast.jsx.

## Iterasi 4 (Sept 2026)
- Penanda risiko berwarna dari penyakit penyerta: merah = hipertensi/preeklamsia, kuning = diabetes melitus, biru = penyakit lain; tampil di daftar pasien, dashboard, header detail, dan kartu Riwayat Kontrol (StatusBadge.jsx: riskFlags/RiskBadges/riskNameColor)
- Bug fix: toast gagal simpan tanggal persalinan kini menampilkan alasan asli backend + date picker dibatasi min=HPHT, max=hari ini (testing iterasi 4: 58/58 pass)

## Iterasi 5 (Sept 2026)
- Pembungkus desktop Windows: /app/electron (Electron + electron-builder NSIS) + GitHub Actions workflow /.github/workflows/build-windows.yml untuk build .exe otomatis di cloud. URL aplikasi diatur via electron/config.json.

## Iterasi 6 (Sept 2026) — 10 fitur permintaan bidan
1. Riwayat kehamilan terstruktur (tahun/tempat/penolong/hasil/penyulit) — repeater di PatientForm, tampil di detail
2. Indikator daftar pasien: selisih_hari (X hari lagi / Terlambat X hari), kontrol fase ke/total + pill Lengkap, legend ANC/KF
3. EdukasiBlast: checkbox pemilih materi (tidak otomatis kirim semua)
4. Timeline kunjungan di profil pasien (K1-K6 per trimester + KF1-KF4, ringkasan lengkap/tidak per fase) — Timeline.jsx + build_timeline backend
5. Kontrol nifas: jenis KB + kontrol rutin KB + imunisasi diberikan + usia bayi — CheckupForm
6. Checklist imunisasi IDAI Edisi 7 (2024): 11 titik jadwal HB-0 s/d booster 18 bulan, status selesai/terlambat/mendekati — ImunisasiPanel.jsx + /api/patients/{id}/imunisasi
7. Rencana Tindak Lanjut (RTL) per kontrol — tampil di kartu jadwal & tabel riwayat
8. Tandai persalinan lengkap: nama anak, jenis kelamin, cara lahir, tempat, penolong, masalah persalinan
9. Template WA imunisasi memakai nama anak (fallback "anak dari Ibu X") via imunisasi_berikutnya
10. Template WA promo pijat bayi memakai nama anak + promo khusus jika anc_lengkap (ANC ≥6x)

## Iterasi 7 (Sept 2026) — 6 penyempurnaan
1. Penyulit riwayat kehamilan: pilihan "Lainnya" membuka input custom; nilai custom otomatis jadi opsi di pengisian berikutnya (GET /api/options/penyulit agregasi distinct dari data pasien)
2. Riwayat kehamilan: tambah pilihan cara lahir (Normal-Spontan / Normal-Vakum/Forceps / Sesar), tampil di profil pasien
3. Catat kontrol: pilihan jenis kunjungan ANC (antenatal) / PNC (postnatal) via select checkup-form-jenis; backend menerima override jenis; section KB/imunisasi mengikuti PNC
4. Edit data persalinan & bayi (nama anak, JK, cara lahir, tempat, penolong, masalah) lewat tombol "Edit Persalinan" pada pasien nifas
5. Template WA custom: judul + isi bisa disimpan (POST /api/templates) dan dipakai ulang; placeholder {nama} {anak} {jadwal} otomatis diganti data pasien; bisa dihapus; validasi panjang & judul duplikat
6. Blast edukasi: nomor urut "1. 2." dihapus — pesan gabungan langsung isi materi
- Hardening: dedup penyulit case-insensitive, guard double-submit modal persalinan (testing iterasi 6: 80/80 pass)

## Backlog
- P1: Pengingat WA otomatis terjadwal (cron harian + integrasi API WhatsApp seperti Fonnte)
- P1: Multi-user (banyak bidan, role admin/staf)
- P2: Cetak/ekspor kartu monitoring (PDF), impor data pasien (CSV)
- P2: Pindahkan JWT ke httpOnly cookie; CORS origins eksplisit; agregasi query (hapus N+1)
- P2: Notifikasi lewat HPL (flag `lewat_hpl` sudah ada di backend, belum ditampilkan di UI)
