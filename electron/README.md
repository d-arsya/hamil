# BidanKu Desktop (Windows .exe)

Pembungkus Electron yang membuka aplikasi web BidanKu sebagai aplikasi desktop Windows.

## Ubah alamat aplikasi
Edit `config.json` → ganti `appUrl` dengan URL aplikasi Anda (setelah deploy, gunakan domain production Anda).

## Cara 1 — Build otomatis via GitHub Actions (tanpa install apa pun)
1. Simpan kode ke GitHub (tombol "Save to GitHub" di Emergent).
2. Di repo GitHub: tab **Actions** → pilih workflow **Build Windows EXE** → **Run workflow**.
3. Setelah selesai (~5-10 menit), download artifact **BidanKu-Windows-Installer**.
4. Jalankan file `.exe` di Windows untuk install — shortcut "BidanKu" muncul di desktop.

## Cara 2 — Build manual di komputer Windows
```
cd electron
npm install
npm run dist
```
Hasil installer ada di `electron/dist/BidanKu Setup 1.0.0.exe`.

## Catatan
- Aplikasi desktop membutuhkan koneksi internet (membuka web app yang live).
- Link WhatsApp (wa.me) otomatis dibuka di browser bawaan.
