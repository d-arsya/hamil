# Perubahan 16 Oktober 2026 — BidanKu

Dokumen ini merangkum perubahan pada **16 Oktober 2026**: fitur notifikasi pemantauan mandiri pasien (iterasi 18).

> Catatan: pengecekan git remote hari ini menunjukkan tidak ada perubahan baru dari remote — seluruh perubahan berasal dari sesi development ini.

## Fitur Baru: Notifikasi Pemantauan Mandiri Pasien

**Masalah**: Bidan harus membuka detail pasien satu per satu untuk mengetahui apakah ada pasien yang mengisi pemantauan mandiri dari portal — terutama yang berisi tanda bahaya.

**Solusi**: Notifikasi langsung di antarmuka klinik.

### Yang ditambahkan

| Bagian | Detail |
|---|---|
| Lonceng notifikasi | Ikon lonceng di header kanan atas (semua halaman klinik), dengan **badge merah** berisi jumlah isian yang belum dibaca |
| Auto-refresh | Data diperbarui otomatis setiap **30 detik** (polling) — tidak perlu refresh halaman |
| Panel notifikasi | Klik lonceng → daftar isian pasien 7 hari terakhir: nama pasien, jenis isian, ringkasan, waktu relatif ("baru saja", "5 menit lalu") |
| Prioritas warna | 🔴 **Merah** = tanda bahaya (pemantauan harian/mingguan dengan keluhan bahaya) · 🟡 **Kuning** = perlu diwaspadai (tidak minum TTD, gerakan bayi <10x) · ⚪ **Putih** = normal |
| Navigasi cepat | Klik item notifikasi → langsung membuka halaman detail pasien terkait |
| Penanda baca | Badge otomatis bersih saat panel dibuka; status "sudah dibaca" tersimpan **per akun bidan** (multi-user tidak saling menghapus) |

### Sumber notifikasi (4 jenis isian pasien dari portal `/ibu`)

1. **Pemantauan harian** — kondisi + tanda bahaya (perdarahan, sakit kepala berat, dll)
2. **Checklist mingguan** — ada/tidak ada keluhan pada checklist minggu ke-X
3. **TTD/MMS** — sudah/tidak minum tablet tambah darah (beserta alasan)
4. **Gerakan bayi** — jumlah gerakan hari ini (peringatan bila <10x)

## Perubahan Teknis

### Backend (`backend/server.py`)
- **Endpoint baru**:
  - `GET /api/notifikasi` — agregasi 4 koleksi (`pemantauan_harian`, `pemantauan_mingguan`, `ttd`, `gerakan`) ber-`created_at` 7 hari terakhir, digabung dengan nama pasien, diurutkan terbaru, maksimal 30 item + jumlah `unread`
  - `POST /api/notifikasi/read` — menandai semua notifikasi sudah dibaca untuk user yang sedang login
- **Koleksi MongoDB baru**: `notif_seen` — menyimpan `last_seen` per user (index unik `user_id`)
- **Penyesuaian**: `POST /api/pasien/gerakan` kini mengisi `updated_at` setiap penambahan hitungan (agar notifikasi gerakan bayi selalu segar, bukan hanya saat pertama dibuat)
- Isian dari pasien yang sudah dihapus otomatis tidak tampil di notifikasi

### Frontend
- **File baru**: `frontend/src/components/NotifikasiBell.jsx` — komponen lonceng + panel (testid: `notif-bell-button`, `notif-badge`, `notif-panel`, `notif-item-{i}`)
- **Diubah**: `frontend/src/components/Layout.jsx` — lonceng ditempatkan di header kanan atas

### Test
- **File baru**: `backend/tests/test_iterasi18_notif.py` (4 test):
  - Isian pemantauan dengan tanda bahaya muncul sebagai notifikasi level `bahaya` + unread bertambah
  - Gerakan bayi <10x muncul sebagai level `waspada`
  - `POST /notifikasi/read` mengosongkan unread
  - Endpoint menolak akses tanpa login (401)

## Optimasi Performa (16 Okt 2026)

Berdasarkan audit performa (agen eksternal user): penambahan pasien & pemuatan halaman bisa mencapai **~40 detik**. Akar masalah: **N+1 query** — setiap pasien memicu 2 query MongoDB sekuensial (2N+2 round-trip untuk N pasien), plus banyak index yang hilang.

### Perbaikan (semua aman untuk data — tanpa menghapus/mengubah data apapun)

| Area | Sebelum | Sesudah |
|---|---|---|
| `GET /api/patients` & `GET /api/dashboard` | Loop per pasien → 2 query DB per pasien (N+1) | Helper `serialize_patients_bulk()`: 2 query paralel (`asyncio.gather`) + join in-memory; field checkups diproyeksikan (5 field saja, bukan 30+) |
| Daftar pasien — badge pemantauan | Scan 50.000 dokumen `pemantauan_harian` semua tanggal | Query difilter `tanggal >= 7 hari lalu` langsung di MongoDB |
| `GET /api/laporan` & `GET /api/followup` | 2-4 query sekuensial, checkups full-field | Query paralel via `asyncio.gather` + proyeksi field minimal |
| Detail pasien, `/api/pasien/me`, `/api/pasien/janji`, `/api/pasien/edukasi-klinik`, pemantauan di detail pasien | 2-5 query sekuensial | `asyncio.gather` (1 round-trip paralel) |
| `DELETE /api/patients/{id}` | 11 `delete_many` sekuensial | 11 `delete_many` paralel |
| Index MongoDB | Hanya 11 index, banyak COLLSCAN (termasuk lookup auth `users.id` di setiap request) | +15 index baru: `id` di patients/users/patient_users/checkups/imunisasi/imunisasi_tt/edukasi/templates, `patient_users.patient_id`, `pemantauan_harian.tanggal`, `pemantauan_mingguan(patient_id, minggu_ke)`, `persiapan.patient_id`, `pengingat.patient_id`, `followup_log.minggu`, `edukasi.fase` — dibuat paralel saat startup, non-unik agar tidak pernah gagal pada data produksi |

### Hasil

| Endpoint | Sebelum | Sesudah |
|---|---|---|
| `/api/patients` | ~40 detik (100 pasien) | ~0,14 detik |
| `/api/dashboard` | ~40 detik | ~0,14 detik |
| `/api/laporan` | lambat (full scan) | ~0,14 detik |
| `/api/followup` | 4x round-trip | ~0,11 detik |
| `/api/notifikasi` | — | ~0,12 detik |

- Full suite backend: **166/167 pass** (1 gagal = `test_laporan_reflects_new_checkup` — flaky race paralel yang sudah diketahui, lolos saat diisolasi; bukan regresi)
- Index dibuat otomatis saat backend start — saat deploy ke produksi, cukup restart backend; data pasien tidak tersentuh sama sekali

## Hasil Pengujian

- Test backend baru: **4/4 pass**
- Verifikasi end-to-end (screenshot): badge muncul saat pasien mengisi → panel menampilkan notifikasi tanda bahaya berwarna merah → badge bersih setelah panel dibuka
- Tidak ada perubahan dependency server pada tanggal ini
