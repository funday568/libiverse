=== CARA MENJALANKAN DENGAN MYSQL ===

1. Nyalakan XAMPP, klik Start pada Apache dan MySQL.
2. Buka http://localhost/phpmyadmin -> tab SQL -> jalankan:
   CREATE DATABASE libiverse;
   (tabel dibuat otomatis oleh server; isi lengkapnya ada di schema.sql)
3. Salin .env.example menjadi .env, isi ADMIN*PASSWORD dan DB* (XAMPP: DB_USER=root, DB_PASS= kosong).
4. Di folder ini jalankan sekali: npm install
5. Kalau admin tidak bisa login, jalankan sekali: node reset-admin.js
   (password admin jadi sama dengan ADMIN_PASSWORD di .env)
6. Jalankan: node server.js -> buka http://localhost:3000
   Saat pertama jalan, isi data.json otomatis dipindahkan ke MySQL.
7. Cek di phpMyAdmin: klik database libiverse -> tabel books -> tab "Jelajahi"/"Browse".

Cara menjalankan:

1. Salin .env.example menjadi .env lalu isi ADMIN_PASSWORD.
2. Jalankan: node server.js -> buka http://localhost:3000
3. Halaman web ada di folder public/. data.json, server.js, dan .env tidak bisa dibuka lewat browser.
4. Backup otomatis harian ada di folder backup/ (disimpan 14 hari). Jika data.json rusak, server berhenti dan data tidak ditimpa.

# 📚 Libiverse — Sistem Manajemen Perpustakaan Digital

Libiverse adalah aplikasi web manajemen perpustakaan modern berbasis **Node.js** murni (tanpa framework berat) yang kini terhubung langsung dengan basis data relasional **MySQL**.

Aplikasi ini mendukung dua peran pengguna:

1. **Anggota (User):** Menjelajah katalog, melihat sinopsis & rekomendasi buku, mengajukan peminjaman, serta memantau status peminjaman dan denda.
2. **Pustakawan (Admin):** Dashboard statistik visual, manajemen katalog buku (termasuk unggah cover), persetujuan peminjaman, pengembalian buku, serta manajemen akun anggota.

---

## 🔄 Evolusi Arsitektur: Dari JSON ke MySQL

Pada tahap prototipe awal, aplikasi ini menggunakan file teks `data.json` untuk menyimpan seluruh data. Penyimpanan JSON sangat praktis untuk demo awal karena tidak memerlukan instalasi database tambahan.

Namun, seiring kesiapan rilis, sistem ditingkatkan ke **MySQL**:

- **Keamanan Data (Transaksi ACID):** Data tidak akan rusak atau hilang jika server mati mendadak saat proses penyimpanan.
- **Mendukung Banyak Pengguna:** Mencegah bentrok data ketika banyak pengguna meminjam buku di detik yang sama.
- **Integritas Relasional:** Data buku, akun, dan transaksi peminjaman memiliki struktur kolom dan tipe data yang teratur.

---

## 📁 Struktur File & Fungsinya

```text
LIBIVERSE/
├── .env                  # Pengaturan rahasia (port, user, password database)
├── .env.example          # Contoh format pengaturan untuk dibagikan
├── .gitignore            # Daftar file yang tidak boleh di-upload ke Git/GitHub
├── package.json          # Daftar modul/library yang dibutuhkan (mysql2)
├── package-lock.json     # Catatan versi modul yang terpasang
├── schema.sql            # Skrip struktur tabel database MySQL
├── db-mysql.js           # Jembatan penghubung Node.js ke MySQL
├── reset-admin.js        # Skrip darurat reset password akun admin
├── server.js             # Otak server backend & API
├── data.json             # Arsip data awal (otomatis dipindahkan ke MySQL saat pertama jalan)
├── sessions.json         # Penyimpanan sesi login aktif
└── public/               # File tampilan yang bisa diakses browser
    ├── index.html        # Halaman utama (katalog publik & landing)
    ├── user.html         # Portal area anggota
    ├── admin.html        # Portal area admin
    ├── login.html        # Form login
    ├── register.html     # Form registrasi anggota baru
    ├── covers/           # Gambar cover buku bawaan
    ├── css/
    │   └── style.css     # Desain tampilan UI, palet tema warna, responsifitas, & badge notifikasi
    └── js/               # Skrip interaksi web
        ├── storage.js    # Penghubung frontend ke backend & fungsi bantuan
        ├── auth.js       # Pengecekan sesi & proteksi halaman
        ├── home.js       # Logika halaman depan & statistik
        ├── login.js      # Logika form login
        ├── register.js   # Logika form pendaftaran anggota baru
        ├── user.js       # Logika katalog, pencarian, & peminjaman anggota
        └── admin.js      # Logika dashboard, CRUD buku, & persetujuan pinjaman

Penjelasan Format Baru
1. .env (Environment Variables): Tempat menaruh data rahasia seperti DB_USER=root dan ADMIN_PASSWORD=admin123. Server
   membaca file ini saat pertama menyala.
2. .gitignore: Daftar penangkal agar folder berat (node_modules/) dan file rahasia (.env) tidak ikut terunggah jika
   proyek ini diunggah ke GitHub.
3. schema.sql: Cetak biru (blueprint) tabel MySQL (7 tabel): users, categories, books, loans, reviews, threads, dan messages.
4. db-mysql.js: Menggunakan Connection Pool untuk menghubungkan server ke database dan menjalankan transaksi
   penyimpanan aman.

   Skema Database Relasional (7 Tabel MySQL)
Aplikasi menggunakan 7 tabel yang dilengkapi kolom extra JSON NULL untuk fleksibilitas penyimpanan data dinamis tanpa perlu migrasi berulang:
   1. users: Akun anggota & admin (id, name, email, passwordHash, role, nim, phone, address, active, created, extra).
      Array Daftar Impian (Wishlist) disimpan aman pada kolom extra JSON.
   2. categories: Kategori koleksi buku (name, urut).
   3. books: Data katalog buku (id, title, author, publisher, year, isbn, cat, stock, img, abstract, synopsis, extra).
   4. loans: Transaksi peminjaman (id, userId, bookId, days, date, due, status, extra).
   5. reviews: Penilaian bintang & ulasan buku (id, userId, bookId, rating, text, date, extra).
   6. threads: Tiket induk percakapan Pusat Bantuan (id, userId, topic, subject, bookId, status, created, updated,
      unreadUser, unreadAdmin, extra).
   7. messages: Isi percakapan pesan (id, threadId, sender, senderId, text, time, extra).

   5 Fitur Baru :
      1. Menu Keranjang / Wishlist (Daftar Impian)
         # Tujuan: Menyimpan buku yang ingin dibaca nanti tanpa langsung meminjam.
         # Fungsi:
            - Tombol ikon hati (❤️) di kartu katalog dan jendela detail buku.
            - Halaman khusus Daftar Impian dengan status stok terkini (Tersedia / Habis).
            - Tombol "Pinjam Semua Sekaligus" (batch checkout) otomatis mengecek kuota pinjam (maks. 3 buku).
            - Data tersimpan di akun anggota (maksimal 100 buku per akun).
      2. Notifikasi Peminjaman Otomatis
         # Tujuan: Pengingat proaktif agar anggota tidak lupa tenggat dan terhindar dari denda.
         # Fungsi: Ikon lonceng (🔔) di navbar dengan badge angka pesan belum dibaca + pop-up toast.
         # 5 Pemicu Notifikasi:
            - Buku siap diambil (status: Disetujui).
            - H-1 & Hari H batas pengembalian.
            - Terlambat & perhitungan denda berjalan.
            - Pesan balasan dari Pustakawan.
            - Ajakan memberi ulasan setelah buku dikembalikan.
            - Riwayat status dibaca disimpan per akun di localStorage.
      3. Ulasan & Rating Buku (1–5 Bintang)
         # Tujuan: Rekomendasi sosial antar-pembaca dan umpan balik koleksi buku.
         # Fungsi:
            - Rating bintang 1–5 dan kolom teks ulasan (maks. 1000 karakter).
            - Terbuka untuk anggota yang sedang meminjam atau sudah mengembalikan buku.
            - 1 anggota = 1 ulasan per buku (mengirim ulang otomatis meng-update).
            - Nilai rata-rata (⭐ 4.8) dan jumlah ulasan tampil di kartu katalog & dialog detail.
            - Nama pengulas disamarkan demi privasi (contoh: Fandili S.).
            - Panel moderasi di dasbor admin untuk menghapus ulasan yang melanggar.
      4. Tanya Pustakawan / Pusat Bantuan
         # Tujuan: Saluran komunikasi resmi 2 arah antara anggota dan petugas perpustakaan.
         # Fungsi:
            - Tiket pesan dengan 4 kategori topik: Usul Buku Baru, Kendala Denda, Pertanyaan Buku, Lainnya.
            - Pintasan langsung kirim pesan dari detail buku atau riwayat denda.
            - Ruang chat per tiket percakapan dengan indikator status (Menunggu Balasan, Dibalas, Selesai).
            - Panel Pesan Masuk di admin dilengkapi kartu ringkasan profil peminjam (NIM, denda aktif, buku dipinjam).
            - Auto-refresh pesan (polling berkala).
      5. Kartu Anggota Digital (Libiverse Card)
         # Tujuan: Kartu identitas anggota yang clean dan profesional seperti smart access card.
         # Fungsi:
            - Header: logo LIBIVERSE di kiri dan badge pangkat anggota di kanan.
            - Tengah: chip emas, nomor anggota, nama (huruf kapital tebal), dan email dengan warna lebih soft.
            - Footer: NIM dan tanggal BERGABUNG di kiri, kode pindai di kanan (pola unik per nomor anggota).
            - Warna kartu mengikuti pangkat (4 tingkat) berdasarkan jumlah buku yang sudah dibaca + bar progres.
            - Fitur avatar/foto profil dihapus agar tampilan tetap minimalis.


Peta & Bedah Kode (Panduan Modifikasi untuk Pemula)
Bagi kamu yang ingin belajar atau memodifikasi fitur di aplikasi ini, berikut adalah peta kode dari masing-masing file:

Penjelasan Tentang Code Libiverse

   1. server.js (Otak Backend)
- Baris 1–31 (Inisialisasi & Pembaca .env): Menentukan port server, lokasi file, batas pinjam aktif
   (MAKS_PINJAM_AKTIF = 3), batas ambil buku (BATAS_AMBIL_HARI = 2), dan membaca file .env tanpa modul pihak ketiga.
- Baris 33–48 (Keamanan Password):
   # hashPassword(pw): Mengacak password menggunakan algoritma scrypt + salt unik.
   # checkPassword(pw, stored): Memvalidasi kecocokan password yang aman dari serangan timing.
- Baris 50–191 (Data Awal):
   # seed(): Menghasilkan data awal buku, kategori, dan akun contoh jika database baru pertama kali dibuat.
- Baris 193–237 (Integrasi MySQL):
   # persist(): Mengantrekan penyimpanan perubahan ke MySQL secara berurutan agar tidak terjadi tabrakan transaksi
      (race condition).
   # gantiPasswordAdminBawaan(): Mengganti password admin lama dengan ADMIN_PASSWORD dari .env.
   # expireBookings(): Otomatis membatalkan peminjaman yang sudah disetujui tetapi tidak kunjung diambil anggota dalam
      batas waktu yang ditentukan.
- Baris 239–281 (Sesi):
   # saveSessions(): Menyimpan sesi ke sessions.json agar tidak logout saat server dinyalakan ulang.
   # getUser(req): Mendeteksi siapa yang sedang membuka halaman dari cookie sesi.
- Baris 283–386 (Ulasan & Rating):
   # bolehUlas(u, bookId): Mengecek anggota pernah meminjam / sudah mengembalikan buku.
   # publicReviews(): Menyiapkan ulasan untuk browser dengan nama pengulas disingkat.
   # simpanUlasan(u, body) & hapusUlasan(u, id): Menyimpan/mengubah dan menghapus ulasan.
- Baris 388–440 (Balasan Admin atas Ulasan):
   # simpanBalasan(u, id, body) & hapusBalasan(u, id): Admin membalas, menyunting, atau menghapus balasan ulasan.
- Baris 442–581 (Tanya Pustakawan):
   # threadsFor(u): Menyaring percakapan (anggota hanya miliknya, admin semuanya).
   # pesanBaru(u, body): Membuat percakapan baru (maks 10 percakapan aktif, pesan maks 2000 karakter).
   # balasPesan(u, body) & ubahThread(u, body): Membalas pesan, menandai dibaca, atau mengubah status Selesai.
- Baris 583–615 (Filter Data):
   # stateFor(u): Menyaring data sesuai peran (Tamu hanya melihat katalog publik; Anggota hanya melihat data
      pribadinya; Admin melihat seluruh data).
- Baris 617–695 (Profil & Hak Akses Penyimpanan):
   # updateProfile(target, data): Mengubah profil (nama, email, NIM, telepon, alamat) dan menolak email ganda.
   # applyChanges(u, body): Memeriksa keamanan saat tombol simpan ditekan (memastikan anggota biasa tidak bisa
      mengubah status pinjaman atau mengubah stok buku).
- Baris 697–756 (Bantuan HTTP & Keamanan Login):
   # Kirim JSON, baca isi request (maks 10MB), jenis file (MIME), cookie sesi HttpOnly.
   # catatGagal(k): Mengunci login 15 menit setelah 5 kali salah password.
- Baris 758–926 (API Endpoints):
   # /api/state : Mengambil status data terbaru sesuai akun yang login.
   # /api/register : Mendaftarkan anggota baru.
   # /api/login & /api/logout : Menangani proses masuk dan keluar akun.
   # /api/password : Mengganti password.
   # /api/delete-me : Menghapus akun sendiri (stok buku yang dipegang dikembalikan).
   # /api/reviews/:id/reply : Balasan admin atas ulasan.
   # /api/review & /api/review-delete : Mengirim dan menghapus ulasan.
   # /api/msg/new, /api/msg/reply, /api/msg/update : Tanya Pustakawan.
   # /api/save : Menerima kiriman data perubahan dari halaman web.
- Baris 928–994 (Server & Start):
   # http.createServer: Alamat /api/ ke router API, selain itu menyajikan file dari folder public/.
   # start(): Memuat data dari MySQL (atau memindahkan data.json) lalu server mulai menerima pengunjung.

   2. db-mysql.js (Jembatan Database)
- pool (Baris 16–24): Menggunakan connection pool agar koneksi database bisa dipakai bergantian secara efisien tanpa harus buka-tutup koneksi
   setiap saat.
- TABLES & SCHEMA (Baris 27–62): Daftar kolom dan query CREATE TABLE IF NOT EXISTS untuk 7 tabel.
- init() & fromRow() (Baris 64–77): Membuat tabel otomatis dan menggabungkan kolom extra (JSON) kembali ke objek.
- loadAll() (Baris 79–90): Membaca semua baris dari database MySQL dan mengemasnya kembali menjadi objek memori yang siap digunakan oleh server.js.
- saveAll(db) (Baris 92–131): Menggunakan transaksi (beginTransaction & commit). Jika salah satu tabel gagal disimpan, MySQL akan melakukan
   rollback sehingga data tetap aman dan konsisten.

   3. public/js/storage.js (Pusat Komunikasi Frontend)
- Baris 7: Menentukan konstanta denda per hari (DENDA_PER_HARI = 1000).
- Baris 31–72: Fungsi api(), loadState(), dan save() untuk mengirim dan menerima data dari server via fetch.
- Baris 73–186: boot() memuat halaman, PAGES & go() untuk pindah halaman.
- Baris 129–140: Perhitungan hari keterlambatan (lateDays) dan nominal denda (fine).
- Baris 187–299: ratingOf(), reviewsHTML(), replyHTML(), apiReply(), delReview() untuk ulasan & balasan admin.
- Baris 300–360: TOPIK, status percakapan, dan chatHTML() untuk tampilan chat Tanya Pustakawan.

   4. public/js/user.js (Fitur Anggota)
- catalog(): Menampilkan kartu buku di katalog, filter kategori, dan pencarian teks judul/penulis/ISBN.
- notifications(), bellHTML(), toggleNotif(), toast(): Notifikasi lonceng dan pop-up pengingat.
- toggleWish(), wishlist(), borrowWishlist(): Daftar Impian dan pinjam sekaligus.
- related(book): Algoritma rekomendasi cerdas (memberikan skor kecocokan berdasarkan kesamaan penulis dan kategori).
- reviewFormHTML(), submitReview(): Formulir ulasan bintang.
- borrow(id): Mengajukan formulir peminjaman dengan pilihan durasi pinjam (1–14 hari).
- borrowing(): Menampilkan riwayat peminjaman saya, status persetujuan, batas waktu pengembalian, dan rincian denda jika terlambat.
- help(), threadView(), replyThread(), closeThread(): Halaman Tanya Pustakawan.
- profile() (Baris 733–904): Form profil dan Kartu Anggota Digital (TIERS di baris 755 menentukan pangkat & warna kartu).

   5. public/js/admin.js (Panel Kontrol Admin)
- aDash(): Menghitung statistik total buku, total anggota, total peminjaman aktif, serta menggambar grafik statistik mingguan langsung di elemen
   <canvas>.
- aBooks() & bookForm(): Daftar manajemen buku, pencarian cepat, formulir tambah/edit buku, serta pembaca unggahan gambar cover (mengubah file
   gambar lokal menjadi Base64 sebelum disimpan).
- aCats(): Menambah dan menghapus kategori.
- aLoans() & loanAct(): Alur kerja transaksi peminjaman:
- disetujui (Menunggu diambil)
- dipinjam (Buku sudah diambil oleh peminjam)
- dikembalikan (Buku kembali, stok otomatis bertambah lagi)
- ditolak / dibatalkan
- aUsers(): Mengaktifkan, menonaktifkan, atau menghapus akun anggota.
- aReviews(), openReply(), submitReply(), delReply(): Moderasi ulasan dan balasan admin (REPLY_TEMPLATES di baris 373).
- aInbox(), adminThread(), adminReply(), setThread(): Pesan Masuk dari anggota.

   6. File JS Lainnya
- public/js/home.js: home() halaman depan, heroSearch() pencarian, homeFx() animasi, hDetail() detail buku untuk tamu.
- public/js/auth.js: currentUser(), logout(), requireLogin(role) untuk proteksi halaman.
- public/js/login.js: login() form masuk.
- public/js/register.js: register() form pendaftaran anggota baru.
- reset-admin.js: Mengatur ulang password admin sesuai ADMIN_PASSWORD di .env.

Pencarian Cepat Modifikasi (Cheat Sheet)
kalo pengen ubah aturan sistem ,Buka file berikut:
- Ubah Nominal Denda: Buka public/js/storage.js baris ke-7 → cari const DENDA_PER_HARI = 1000;.
- Ubah Batas Hari Pengambilan Buku (Booking): Buka server.js baris ke-31 → cari BATAS_AMBIL_HARI = 2;.
- Ubah Warna Tampilan / Tema: Buka public/css/style.css bagian :root di baris atas untuk mengganti kode warna utama.
- Ubah Format/Aturan Input Buku: Buka public/js/admin.js di fungsi bookForm().
- Ubah Batas Jumlah Buku Dipinjam: Buka server.js baris ke-19 → cari MAKS_PINJAM_AKTIF = 3;.
- Ubah Pangkat / Warna Kartu Anggota: Buka public/js/user.js baris ke-755 → cari const TIERS.
```

---

## ⭐ Fitur Baru: Ulasan & Rating Buku

Tujuan: memberi rekomendasi sosial dan meningkatkan interaksi antar-pembaca.

**Untuk Anggota**

- Beri rating 1–5 bintang + ulasan teks (opsional, maks 1000 karakter) untuk buku yang **sedang dipinjam** (status "Dipinjam") atau **sudah dikembalikan** ("Dikembalikan").
- Satu ulasan per buku per anggota. Mengirim lagi = mengubah ulasan lama. Ulasan sendiri bisa dihapus.
- Tombol **⭐ Beri Ulasan** ada di tabel _Peminjaman Saya_, dan muncul notifikasi 🔔 ajakan mengulas setelah buku dikembalikan.
- Kartu katalog menampilkan rata-rata rating (contoh: ⭐ 4.8 (12)). Katalog bisa diurutkan "⭐ Rating Tertinggi" / "💬 Paling Banyak Diulas".
- Jendela detail buku menampilkan ringkasan rating (rata-rata + grafik bintang 5→1) dan daftar ulasan pembaca.

**Untuk Tamu (beranda)**: rating di kartu buku dan daftar ulasan di detail buku bisa dilihat tanpa login.

**Untuk Admin**: menu **⭐ Ulasan** untuk memantau semua ulasan, filter per bintang, dan menghapus ulasan yang tidak pantas. Kolom Rating di Manajemen Buku dan kartu "Rata-rata Rating" di Dashboard.

**Teknis**

- Tabel MySQL baru `reviews` (id, userId, bookId, rating, text, date) — dibuat otomatis saat server menyala (juga ada di schema.sql).
- API baru: `POST /api/review` { bookId, rating, text } dan `POST /api/review-delete` { id }. Server memeriksa: wajib login, bukan admin, pernah meminjam buku, rating 1–5.
- Nama pengulas ditampilkan singkat (contoh "Fandili S.") agar nama lengkap tidak terlihat publik.
- Ulasan ikut terhapus jika akun anggota atau bukunya dihapus.
- File yang diubah: server.js, db-mysql.js, schema.sql, public/js/storage.js, user.js, home.js, admin.js, public/css/style.css.

---

## 💬 Fitur Baru: Tanya Pustakawan / Pusat Bantuan

Tujuan: saluran komunikasi resmi antara anggota dan petugas perpustakaan.

**Untuk Anggota** (menu **💬 Tanya Pustakawan**)

- Formulir kirim pesan dengan 4 topik: 📗 Usul Buku Baru, 💰 Kendala Denda, 📖 Pertanyaan Seputar Buku (bisa pilih buku terkait), 💬 Lainnya.
- Pertanyaan Umum (FAQ) tentang denda, batas pinjam, batas ambil, dan cara usul buku.
- Riwayat percakapan tersimpan per akun, dengan status: Menunggu Balasan / Dibalas / Selesai. Anggota bisa membalas lagi atau menandai selesai.
- Notifikasi 🔔 dan angka merah di menu saat pustakawan membalas.
- Pintasan: tombol "💬 Tanya Pustakawan" di detail buku (topik buku otomatis terpilih) dan tautan "Ada kendala denda?" di halaman Peminjaman.

**Untuk Admin** (menu **💬 Pesan Masuk**)

- Daftar percakapan dengan filter status, topik, dan pencarian. Klik untuk membaca dan membalas dalam tampilan chat.
- Info anggota (email, NIM, pinjaman aktif, total denda) tampil di atas percakapan.
- Tandai Selesai / Buka Kembali. Kartu "Pesan Belum Dibalas" di Dashboard. Halaman diperbarui otomatis tiap 20 detik.

**Teknis**

- Tabel MySQL baru `threads` (percakapan) dan `messages` (isi pesan) — dibuat otomatis (juga ada di schema.sql).
- API: `POST /api/msg/new` { topic, subject, text, bookId? }, `POST /api/msg/reply` { threadId, text }, `POST /api/msg/update` { threadId, read?, status? }.
- Server memeriksa: wajib login, anggota hanya bisa melihat & membalas percakapannya sendiri, isi pesan maks 2000 karakter, maksimal 10 percakapan aktif per anggota.
- Percakapan ikut terhapus jika akun anggota dihapus.
