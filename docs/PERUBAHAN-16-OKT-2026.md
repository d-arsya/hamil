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

## Hasil Pengujian

- Test backend baru: **4/4 pass**
- Verifikasi end-to-end (screenshot): badge muncul saat pasien mengisi → panel menampilkan notifikasi tanda bahaya berwarna merah → badge bersih setelah panel dibuka
- Tidak ada perubahan dependency server pada tanggal ini
