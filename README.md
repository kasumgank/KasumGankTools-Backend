# KasumGangTools Backend (starter)

Backend API awal untuk dipasang di Render dan dipakai oleh frontend Netlify.

## Yang sudah tersedia
- API status: `GET /api/health`
- Daftar akun dan login dengan password hash
- Profil pengguna: `GET /api/me`
- Daftar bot milik pengguna
- Direktori bot publik
- Statistik owner (role diperiksa di server)

## Yang BELUM tersedia
Koneksi WhatsApp, QR/pairing, penyimpanan sesi WhatsApp, dan worker bot belum dibuat. Tombol tambah bot saat ini hanya membuat data bot berstatus offline. Jadi jangan menganggap bot sudah bisa menerima pesan.

## 1. Buat database PostgreSQL
Buat database PostgreSQL (misalnya di Neon atau penyedia PostgreSQL lain), lalu salin connection string-nya. Simpan sebagai `DATABASE_URL` di Environment Variables Render. Jangan kirim connection string atau password ke chat.

## 2. Upload ke GitHub
1. Ekstrak ZIP ini.
2. Buat repository GitHub baru bernama `kasumgangtools-backend`.
3. Upload seluruh isi folder ini ke root repository (pastikan `package.json` dan `server.js` terlihat di halaman utama repo).
4. Jangan upload file `.env` atau password.

## 3. Buat service di Render
1. Render Dashboard -> New -> Web Service.
2. Hubungkan GitHub dan pilih repository `kasumgangtools-backend`.
3. Runtime: Node.
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Tambahkan Environment Variables:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = connection string PostgreSQL
   - `JWT_SECRET` = string acak panjang minimal 32 karakter
   - `FRONTEND_URL` = alamat website Netlify kamu, misalnya `https://nama-web.netlify.app`
   - `OWNER_EMAIL` = email yang akan menjadi owner saat mendaftar pertama kali
7. Deploy.

## 4. Buat tabel database
Jalankan isi file `schema.sql` satu kali di SQL Editor database PostgreSQL sebelum mencoba register.

## 5. Tes
Buka `https://ALAMAT-SERVICE-RENDER/api/health`. Jika sukses, hasilnya `{"ok":true,"database":"connected"}`.

## Catatan penting
- Paket Render gratis dapat tidur saat tidak digunakan; tidak cocok untuk jaminan bot WhatsApp 24 jam.
- Frontend Netlify belum otomatis terhubung. `API_BASE` pada frontend harus diisi dengan URL service Render setelah backend aktif.
- Jangan pernah menaruh `DATABASE_URL`, `JWT_SECRET`, QR login, pairing code, atau file sesi di frontend/public GitHub.
- Integrasi WhatsApp perlu tahap terpisah, penyimpanan sesi privat per akun, batas penggunaan, dan pengujian. Gunakan hanya untuk percakapan yang diizinkan dan hindari spam.
