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

## Iterasi 7 (Sept 2026) — 4 penyempurnaan
1. Catat kontrol: pilihan detail kunjungan K1-K6 (ANC) / KF1-KF4 (PNC) via checkup-form-ke; compute_status & timeline berbasis nomor ke (bukan urutan); duplikat nomor kunjungan ditolak 400
2. Modal Kirim Edukasi WA: bisa muat & simpan template custom (dropdown blast-template-select + blast-template-save), placeholder {nama}/{anak}/{jadwal} dipersonalisasi per pasien saat kirim
3. Template WA tersinkron satu koleksi /api/templates — dipakai modal WA pasien & modal edukasi
4. Menu Laporan baru (/laporan): ketuntasan per K1-K6 & KF1-KF4 (bar %), tuntas vs lost to follow up, persentase penyakit penyerta & penyulit tertinggi — endpoint GET /api/laporan

## Iterasi 8 (Sept 2026) — Security audit & hardening
- Audit keamanan: 1 CRITICAL (password admin default admin123 yang pulih-sendiri tiap restart) → DIPERBAIKI: password kuat di env, logika re-sync password dihapus (password tidak lagi ke-reset saat restart), endpoint POST /api/auth/change-password + tombol "Ganti Password" di sidebar
- Catatan audit lain (P3, diterima untuk MVP single-tenant): JWT di localStorage, CORS wildcard (auth via header bukan cookie), N+1 query, JWT_SECRET di .env (disarankan rotasi & jangan commit ke repo publik)

## Iterasi 9 (Sept 2026)
- No. RM (rekam medis) pasien: field form, tampil di daftar & detail
- TTV lengkap di catat kontrol: SpO2, suhu, nadi, RR, LiLa, tinggi badan (tanpa grafik), tampil ringkas di kolom TD/TTV tabel riwayat
- Checklist imunisasi TT ibu hamil (TT1-TT5, interval Kemenkes: TT2=4 mgg pasca TT1, TT3=6 bln, TT4/TT5=1 th) — ImunisasiTTPanel.jsx + /api/patients/{id}/imunisasi-tt, target dihitung dari tanggal dosis sebelumnya

## Iterasi 10 (Sept 2026) — Portal Pasien Mobile-First
- Akun pasien dibuat klinik dari rekam medis (POST /api/patients/{id}/akun → username+password sekali tampil, bisa reset); login terpisah /pasien/login dengan JWT role "pasien" (tidak bisa akses endpoint klinik)
- Onboarding pasien: golongan darah, pendamping, kontak darurat, faskes (profil_lengkap gate)
- Beranda: greeting, kartu kehamilan (usia/trimester/HPL/countdown/progress), quick actions, checklist harian, pengingat kontrol, pesan bidan, edukasi per trimester
- Pemantauan harian (form <1 menit, deteksi tanda bahaya → peringatan), Pemantauan mingguan (checklist Buku KIA per trimester)
- TTD/MMS tracker (kalender bulanan, kepatuhan, streak, alasan tidak minum, tips)
- Gerakan bayi (counter ≥24 minggu, target ≥10/12 jam, grafik 14 hari)
- Tanda bahaya per fase + tombol telepon kontak darurat
- Persiapan persalinan (13 checklist + progress), Edukasi (9 kategori kartu + pesan bidan), Perjalanan (timeline sinkron klinik), Riwayat, Pengaturan (5 toggle reminder, kontak, logout)
- Disclaimer medis di semua halaman; data sinkron via endpoint /api/pasien/*
- File: /app/frontend/src/pages/pasien/* (12 halaman), /app/frontend/src/lib/pasienApi.js, /app/frontend/src/lib/konten.js

- Hardening: hapus pasien kini cascade ke seluruh data portal (akun, pemantauan, TTD, gerakan, dll); login pasien punya lockout brute-force 5x → 15 menit (testing iterasi 10: 133/133 pass)
- Bug fix iterasi 11: route collision /pasien (daftar pasien klinik vs beranda portal) → portal pasien dipindah ke /ibu/*; daftar pasien klinik normal kembali
- Iterasi 12-13: performa portal pasien (React.lazy code splitting, login <0.5s) + fix endpoint collision /ibu→/pasien di API calls (testing iterasi 13: 133/133 pass, 11/11 route portal OK)

## Iterasi 14 (Okt 2026) — 7 fitur permintaan bidan
1. "Pesan dari Bidan" dihapus dari portal pasien (Beranda & EdukasiPasien); endpoint /pasien/edukasi-klinik dipertahankan
2. Pemantauan mandiri pasien tampil di klinik: panel PemantauanPasien.jsx di detail pasien (harian/mingguan/TTD/gerakan, GET /api/patients/{id}/pemantauan) + badge "Bahaya"/"Pantau baru" di daftar pasien (field pantau di GET /api/patients untuk pemantauan ≤7 hari)
3. Laporan tambahan: kartu "Perlu Follow-Up Kontrol" & "Perlu Update Data" (identitas belum lengkap / >30 hari tidak kontrol) dengan daftar nama yang bisa diklik — field perlu_followup(_list) & perlu_update(_list) di GET /api/laporan
4. TTD tanggal terlewat bisa diisi/diubah lewat kalender (klik tanggal lampau → modal, alasan wajib, bisa custom); backend menolak tanggal lampau tanpa alasan & tanggal masa depan (POST /api/pasien/ttd)
5. Menu Janji Temu portal ibu (/ibu/janji): tombol sekali klik → wa.me nomor bidan dengan pesan template terisi data pasien (GET /api/pasien/janji); nomor WA bidan + template diatur di halaman Profil (GET/PUT /api/pengaturan, koleksi pengaturan id=klinik, normalisasi 08→62)
6. Menu Follow-Up Mingguan (/followup): semua pasien aktif (prioritas jatuh tempo ≤7 hari/terlambat di atas), template pengingat kontrol bisa diedit, tombol "Kirim WA & Tandai" menandai sudah follow-up per minggu ISO (koleksi followup_log, GET /api/followup + POST /api/followup/{id})
7. Halaman Profil (/profil): nomor WA bidan, template janji & follow-up, manajemen pengguna (GET/POST /api/auth/users — tambah user akses penuh, username unik, password ≥8), ganti password
- Fix critical: sisa blok JSX "pesan" di Beranda.jsx menyebabkan crash portal (testing iterasi 14: 19/19 backend baru pass, 131/133 legacy pass — 2 flaky lockout/timeout pre-existing; frontend 100% setelah fix)

## Iterasi 15 (Okt 2026) — Code quality & security hardening (dari code review)
- Auth migrasi ke httpOnly cookie (SameSite=Lax, Secure): login klinik & pasien set cookie `bidanku_token`/`bidanku_pasien`, endpoint POST /api/auth/logout & /api/pasien/logout; Bearer header tetap didukung sebagai fallback (kompatibel dengan API test). Frontend tidak lagi menyimpan token di localStorage (api.js/pasienApi.js withCredentials, AuthContext cek /auth/me via cookie)
- Refactor kompleksitas: compute_status dipecah (helper _jadwal_berikutnya), laporan() dipecah (helper _done_ke, _ketuntasan_kunjungan, _evaluasi_pasien, _profil_risiko) — kompleksitas 57 → terdistribusi ke fungsi-fungsi kecil
- Hook dependencies diperbaiki dengan useCallback (Patients, PatientDetail, PasienLayout, Beranda, TTD, FollowUp, Profil); komponen PatientDetail dipecah: grafik → PatientCharts.jsx, TTV ringkas → helper ttvRingkas
- Index-as-key diperbaiki: PatientForm repeater riwayat memakai _key (crypto.randomUUID, distrip saat submit), PatientDetail riwayat list memakai composite key
- Stabilitas test: TestLockout & TestBruteForce kini memakai user khusus (test_lockout_user / test_bruteforce_user) + pembersihan login_attempts terscope per-user; test auth-negatif membersihkan cookie session. Full suite stabil: 152/152 pass
- Catatan yang disengaja tidak diubah: rewrite form besar (CheckupForm/PatientForm) & type-hint file test — risiko regresi tinggi tanpa manfaat fungsional, sudah tercakup test

## Iterasi 16 (Okt 2026) — Follow-up WA fix & TTV portal pasien
- Fix tombol "Kirim WA & Tandai" di /followup: window.open kini dipanggil sinkron saat klik (sebelumnya setelah await → diblokir popup blocker); guard nomor WA kosong; penandaan follow-up tetap via POST /api/followup/{id}
- TTV tampil di portal pasien: endpoint GET /api/pasien/ttv (20 kontrol terakhir) + halaman /ibu/ttv (TandaVital.jsx) — tiap tanda vital dievaluasi thd batas normal (TD ≥140/90 waspada, ≥160/110 bahaya; suhu ≥37,5; nadi >100; RR >20; SpO2 <95; LiLa <23,5 KEK) dengan chip merah/kuning/hijau + edukasi per tanda + banner status terkini + kartu "Kenali Tanda Vital"
- Akses: kartu "Tanda Vital Saya" di Beranda portal + menu Lainnya
- Test baru TestTTVPortal (2 test) di test_portal_pasien.py — 27/27 pass

## Iterasi 17 (Okt 2026) — BPJS, detail bayi, edit kontrol, resume PDF
- Merge perubahan git remote user (setupProxy.js + vercel.json proxy, samesite=lax→none untuk deployment Vercel, hapus emergentintegrations dari requirements)
- No. BPJS opsional: PatientInput.no_bpjs + serializer + PatientForm (setelah No. RM) + InfoItem di detail pasien
- LiLa dihapus dari form catat kontrol (data lama tetap tampil di histori/portal)
- Form kontrol PNC: seksi Pemeriksaan Fisik Bayi (bayi_bb gr, bayi_pb cm, bayi_lk cm, bayi_suhu, bayi_tali_pusat, bayi_ikterus)
- Form kontrol ANC: seksi Detail Bayi (djj, letak_plasenta, ketuban, tbj, jumlah_janin, keadaan_janin, lokasi_kehamilan, presentasi, jk_janin)
- Ceklis kunjungan sebelumnya tanpa data (chips K1-K6/KF1-KF4, tercatat dengan catatan "Ditandai manual")
- Edit riwayat kontrol: PUT /api/checkups/{id} (CHECKUP_EDITABLE_FIELDS, jenis/ke immutable, tanggal tidak boleh masa depan) + tombol edit per baris di detail pasien
- Resume kontrol export PDF: lib/resume.js cetakResumeKontrol() — window print (Save as PDF), tombol dokumen per baris kontrol
- Test baru test_iterasi17_fitur.py (9 test); fix flaky lockout test_portal_pasien.py (clear_pasien_attempts terscope per akun)
- Fix regresi nyata yang ditemukan saat testing: PUT /api/checkups partial body men-set tanggal=null → compute_status 500 (dashboard & laporan down). Fix: tanggal hanya di-update bila dikirim + data terkontaminasi diperbaiki via mongosh
- Stabilitas suite paralel: teardown test_portal_pasien di-scope ke pasien modul sendiri (sebelumnya menghapus semua TEST_portal_* → cascade delete akun worker lain → 401); assertion count laporan global di-longgarkan == → >= (race antar worker)
- Full suite: 163/163 pass; testing agent iter15: frontend 100%, tidak ada bug fungsional

## Backlog
- P1: Pengingat WA otomatis terjadwal (cron harian + integrasi API WhatsApp seperti Fonnte)
- P1: Multi-user (banyak bidan, role admin/staf)
- P2: Cetak/ekspor kartu monitoring (PDF), impor data pasien (CSV)
- P2: Pindahkan JWT ke httpOnly cookie; CORS origins eksplisit; agregasi query (hapus N+1)
- P2: Notifikasi lewat HPL (flag `lewat_hpl` sudah ada di backend, belum ditampilkan di UI)
