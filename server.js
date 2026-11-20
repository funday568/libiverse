// ===== server.js =====
// Backend Libiverse (Node.js + MySQL lewat library mysql2).
// - Menyajikan file HTML/CSS/JS
// - Autentikasi di server: password di-hash dengan scrypt + salt acak
// - Sesi lewat cookie HttpOnly (tidak bisa dibaca JavaScript di browser)
// - Data disimpan di database MySQL (lihat db-mysql.js)
// Jalankan: node server.js  → buka http://localhost:3000
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Pengaturan dasar: port server, folder proyek, dan lokasi file data.
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const DATA_FILE = path.join(ROOT, "data.json");
const SESSION_FILE = path.join(ROOT, "sessions.json");
const MAKS_PINJAM_AKTIF = 3;

// Baca file .env sederhana (KUNCI=nilai) tanpa library tambahan.
try {
  for (const line of fs
    .readFileSync(path.join(ROOT, ".env"), "utf8")
    .split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined)
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}
const BATAS_AMBIL_HARI = 2; // batas pengambilan buku setelah booking disetujui

// ---------- Hashing password ----------
// Ubah password jadi hash scrypt + salt acak agar tidak disimpan dalam bentuk asli.
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

// Cocokkan password yang diketik dengan hash tersimpan (aman dari timing attack).
function checkPassword(pw, stored) {
  if (!stored || !stored.startsWith("scrypt$")) return false;
  const [, salt, hash] = stored.split("$");
  const a = Buffer.from(hash, "hex"),
    b = crypto.scryptSync(String(pw), salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- Data ----------
// Tanggal hari ini (+d hari) dalam format YYYY-MM-DD.
const today = (d = 0) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};

// Data awal (akun admin & user contoh, kategori, buku) jika data.json belum ada.
function seed() {
  const B = (
    id,
    title,
    author,
    publisher,
    year,
    isbn,
    cat,
    stock,
    abstract,
    synopsis,
  ) => ({
    id,
    title,
    author,
    publisher,
    year,
    isbn,
    cat,
    stock,
    img: "",
    abstract,
    synopsis,
  });
  return {
    users: [
      {
        id: 1,
        name: "Fandili Setia Dwi Yanto",
        email: "fandi@gmail.com",
        passwordHash: hashPassword(
          process.env.ADMIN_PASSWORD ||
            crypto.randomBytes(9).toString("base64url"),
        ),
        role: "admin",
        nim: "2605090063",
        phone: "081234567890",
        address: "Indonesia",
        active: true,
        created: today(),
      },
      {
        id: 2,
        name: "User Libiverse",
        email: "user@libiverse.com",
        passwordHash: hashPassword("user1234"),
        role: "user",
        nim: "2605090000",
        phone: "081200000000",
        address: "Jl. Contoh No. 123",
        active: true,
        created: today(),
      },
    ],
    categories: ["Fiction", "Non-Fiction", "Science", "Technology", "History"],
    books: [
      B(
        1,
        "Laskar Pelangi",
        "Andrea Hirata",
        "Bentang",
        2005,
        "9789793062792",
        "Fiction",
        5,
        "Novel tentang perjuangan pendidikan anak-anak miskin di Belitung dan semangat guru yang tak kenal lelah.",
        "Sepuluh anak dari keluarga miskin bersekolah di SD Muhammadiyah Gantong yang hampir ditutup. Dibimbing Bu Muslimah dan Pak Harfan, mereka—dijuluki Laskar Pelangi—menghadapi keterbatasan dengan persahabatan, kecerdasan, dan mimpi besar.",
      ),
      B(
        2,
        "Bumi Manusia",
        "Pramoedya Ananta Toer",
        "Hasta Mitra",
        1980,
        "9789799731234",
        "Fiction",
        4,
        "Roman sejarah tentang kebangkitan kesadaran bangsa pada masa kolonial Hindia Belanda.",
        "Minke, pemuda pribumi terpelajar di sekolah Belanda, jatuh cinta pada Annelies, putri Nyai Ontosoroh. Kisah cinta mereka berbenturan dengan hukum kolonial yang tidak adil, membuka mata Minke tentang arti menjadi manusia merdeka.",
      ),
      B(
        3,
        "Atomic Habits",
        "James Clear",
        "Avery",
        2018,
        "9780735211292",
        "Non-Fiction",
        6,
        "Panduan praktis membangun kebiasaan baik dan menghilangkan kebiasaan buruk melalui perubahan kecil.",
        "James Clear menjelaskan bahwa perubahan 1% setiap hari menghasilkan hasil luar biasa. Dengan empat hukum perubahan perilaku—jelas, menarik, mudah, dan memuaskan—pembaca diajak merancang sistem, bukan sekadar menetapkan tujuan.",
      ),
      B(
        4,
        "Sapiens",
        "Yuval Noah Harari",
        "Harper",
        2011,
        "9780062316097",
        "History",
        3,
        "Sejarah singkat umat manusia dari zaman batu hingga era modern.",
        "Harari menelusuri tiga revolusi besar—kognitif, pertanian, dan ilmiah—yang membentuk Homo sapiens. Buku ini mempertanyakan bagaimana mitos bersama, uang, dan kekaisaran memungkinkan manusia bekerja sama dalam skala besar.",
      ),
      B(
        5,
        "Clean Code",
        "Robert C. Martin",
        "Prentice Hall",
        2008,
        "9780132350884",
        "Technology",
        2,
        "Prinsip dan praktik menulis kode program yang bersih, mudah dibaca, dan mudah dirawat.",
        "Melalui contoh nyata, Uncle Bob menunjukkan cara memberi nama yang baik, menulis fungsi kecil, menangani error, dan melakukan refactoring. Buku ini menjadi pegangan wajib bagi programmer profesional.",
      ),
      B(
        6,
        "A Brief History of Time",
        "Stephen Hawking",
        "Bantam",
        1988,
        "9780553380163",
        "Science",
        3,
        "Penjelasan populer tentang kosmologi: asal-usul alam semesta, lubang hitam, dan sifat waktu.",
        "Stephen Hawking mengajak pembaca memahami Big Bang, lubang hitam, relativitas, dan mekanika kuantum dengan bahasa sederhana, sambil mencari jawaban atas pertanyaan terbesar: dari mana alam semesta berasal dan ke mana ia akan pergi?",
      ),
    ],
    loans: [],
  };
}

// ---------- Database MySQL ----------
// Data dibaca dari MySQL saat server mulai (lihat start() di bawah), lalu disimpan di memori.
const store = require("./db-mysql");
let db;

// Simpan ke MySQL. Antrian memastikan simpanan diproses berurutan, tidak bentrok.
let antrian = Promise.resolve();
function persist() {
  const salinan = JSON.parse(JSON.stringify(db));
  antrian = antrian
    .then(() => store.saveAll(salinan))
    .catch((e) => console.error("Gagal menyimpan ke MySQL:", e.message));
  return antrian;
}

// Password admin bawaan lama (fandi123) diganti otomatis dengan ADMIN_PASSWORD dari .env.
function gantiPasswordAdminBawaan() {
  for (const a of db.users.filter((x) => x.role === "admin")) {
    if (checkPassword("fandi123", a.passwordHash)) {
      const pw =
        process.env.ADMIN_PASSWORD ||
        crypto.randomBytes(9).toString("base64url");
      a.passwordHash = hashPassword(pw);
      console.log(
        process.env.ADMIN_PASSWORD
          ? `Password admin ${a.email} diganti dengan ADMIN_PASSWORD dari .env`
          : `PENTING: password admin ${a.email} sekarang: ${pw} (catat, lalu ganti lewat halaman profil)`,
      );
    }
  }
}

// Booking yang disetujui tapi tidak diambil sampai batas waktu → kedaluwarsa, stok dikembalikan.
function expireBookings() {
  let changed = false;
  db.loans.forEach((l) => {
    if (l.status === "Siap Diambil" && l.pickupBy && today() > l.pickupBy) {
      l.status = "Booking Kedaluwarsa";
      const b = db.books.find((x) => x.id === l.bookId);
      if (b) b.stock++;
      changed = true;
    }
  });
  if (changed) persist();
}

// ---------- Sesi ----------
// Daftar sesi login yang aktif disimpan di memori server.
// Disimpan juga ke sessions.json agar tidak logout saat server dinyalakan ulang.
const SESSION_AGE = 86400 * 1000;
let sessions = new Map(); // token -> { id, exp }
try {
  sessions = new Map(
    Object.entries(JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"))).filter(
      ([, v]) => v.exp > Date.now(),
    ),
  );
} catch {}
const saveSessions = () => {
  try {
    fs.writeFileSync(
      SESSION_FILE,
      JSON.stringify(Object.fromEntries(sessions)),
    );
  } catch {}
};

// Ambil user yang login dari cookie "sid"; akun nonaktif dianggap tidak login.
function getUser(req) {
  const m = /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || "");
  const s = m && sessions.get(m[1]);
  const id = s && s.exp > Date.now() && s.id;
  const u = id && db.users.find((x) => x.id === id);
  return u && u.active ? u : null;
}

// Buang passwordHash sebelum data user dikirim ke browser,
// lalu tambahkan memberNo = nomor urut anggota (dipakai untuk ID kartu LIBI-000001 dst).
// Dihitung di server karena hanya server yang memegang daftar SEMUA anggota.
const publicUser = (u) => {
  const { passwordHash, ...rest } = u;
  if (u.role === "admin") return { ...rest, memberNo: 0 }; // admin tidak ikut nomor anggota
  const members = db.users
    .filter((x) => x.role !== "admin")
    .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0)); // id = waktu daftar
  const idx = members.findIndex((x) => x.id === u.id);
  return { ...rest, memberNo: idx >= 0 ? idx + 1 : members.length + 1 };
};

// ---------- Ulasan & Rating ----------
// Status pinjaman yang dianggap "sudah membaca": sedang dipinjam atau sudah dikembalikan.
const BOLEH_ULAS = ["Dipinjam", "Dikembalikan"];
const MAKS_TEKS_ULASAN = 1000;
const bolehUlas = (u, bookId) =>
  u.role !== "admin" &&
  db.loans.some(
    (l) =>
      l.userId === u.id && l.bookId === bookId && BOLEH_ULAS.includes(l.status),
  );

// Nama pengulas disingkat (contoh: "Fandili S.") agar nama lengkap tidak tampil ke publik.
const namaPendek = (n) => {
  const p = String(n || "Anggota")
    .trim()
    .split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0].toUpperCase()}.` : p[0];
};

// Ulasan yang dikirim ke browser: hanya untuk buku yang masih ada, tanpa data pribadi.
function publicReviews() {
  return db.reviews
    .filter((r) => db.books.some((b) => b.id === r.bookId))
    .map((r) => {
      const w = db.users.find((x) => x.id === r.userId);
      const reply =
        r.reply && r.reply.text
          ? {
              text: r.reply.text,
              date: r.reply.date,
              adminName: r.reply.adminName || "Pustakawan",
              edited: !!r.reply.edited,
              outdated: !!r.reply.outdated,
            }
          : null;
      return {
        id: r.id,
        userId: r.userId,
        bookId: r.bookId,
        rating: r.rating,
        text: r.text || "",
        date: r.date,
        name: namaPendek(w && w.name),
        reply,
      };
    });
}

// Buang ulasan milik akun atau buku yang sudah dihapus.
const bersihkanUlasan = () => {
  db.reviews = db.reviews.filter(
    (r) =>
      db.users.some((x) => x.id === r.userId) &&
      db.books.some((b) => b.id === r.bookId),
  );
  // Percakapan milik akun yang sudah dihapus ikut dibuang.
  db.threads = db.threads.filter((t) =>
    db.users.some((x) => x.id === t.userId),
  );
  const ids = new Set(db.threads.map((t) => t.id));
  db.messages = db.messages.filter((m) => ids.has(m.threadId));
};

// Simpan ulasan: wajib pernah meminjam buku, rating 1-5, teks maks 1000 karakter. Kirim ulang = ubah ulasan lama.
function simpanUlasan(u, body) {
  const bookId = Number(body.bookId);
  const rating = Number(body.rating);
  const text = String(body.text || "").trim();
  if (u.role === "admin") return "Admin tidak dapat memberi ulasan";
  if (!db.books.some((b) => b.id === bookId)) return "Buku tidak ditemukan";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return "Pilih rating 1 sampai 5 bintang";
  if (text.length > MAKS_TEKS_ULASAN)
    return `Ulasan maksimal ${MAKS_TEKS_ULASAN} karakter`;
  if (!bolehUlas(u, bookId))
    return "Kamu bisa memberi ulasan setelah meminjam buku ini";
  const lama = db.reviews.find((r) => r.userId === u.id && r.bookId === bookId);
  if (lama) {
    Object.assign(lama, { rating, text, date: today() });
    if (lama.reply) lama.reply.outdated = true; // ulasan diubah setelah dibalas → admin diberi tanda
  } else
    db.reviews.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      userId: u.id,
      bookId,
      rating,
      text,
      date: today(),
    });
  persist();
  return null;
}

// Hapus ulasan: pemilik ulasan atau admin (moderasi).
function hapusUlasan(u, id) {
  const r = db.reviews.find((x) => x.id === Number(id));
  if (!r) return "Ulasan tidak ditemukan";
  if (r.userId !== u.id && u.role !== "admin")
    return "Kamu hanya bisa menghapus ulasanmu sendiri";
  db.reviews = db.reviews.filter((x) => x !== r);
  persist();
  return null;
}

// ---------- Balasan Admin atas Ulasan ----------
// Struktur: review.reply = { text, date: "YYYY-MM-DD", adminName, adminId, edited, outdated }
// Disimpan otomatis di kolom "extra" tabel reviews (lihat db-mysql.js), jadi tidak perlu migrasi tabel.
const MAKS_TEKS_BALASAN = 1000;

// Sanitasi teks: buang tag HTML, karakter < >, karakter kontrol, dan baris kosong berlebih.
// (Tampilan di browser tetap di-escape lewat esc(); ini lapisan pengaman kedua.)
const bersihkanTeks = (s) =>
  String(s ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// Tambah / sunting balasan. Hasil: null jika berhasil, atau [kodeHTTP, pesanError].
function simpanBalasan(u, id, body) {
  if (!u || u.role !== "admin")
    return [403, "Hanya pustakawan (admin) yang dapat membalas ulasan"];
  const r = db.reviews.find((x) => x.id === Number(id));
  if (!r) return [404, "Ulasan tidak ditemukan"];
  const raw = String((body && body.text) ?? "");
  if (raw.length > MAKS_TEKS_BALASAN * 2)
    return [400, `Balasan maksimal ${MAKS_TEKS_BALASAN} karakter`];
  const text = bersihkanTeks(raw);
  if (!text) return [400, "Balasan tidak boleh kosong"];
  if (text.length > MAKS_TEKS_BALASAN)
    return [400, `Balasan maksimal ${MAKS_TEKS_BALASAN} karakter`];
  const adminName = bersihkanTeks(u.name).slice(0, 60) || "Pustakawan";
  r.reply = {
    text,
    date: today(),
    adminName,
    adminId: u.id,
    edited: !!r.reply,
    outdated: false,
  };
  persist();
  return null;
}

// Hapus balasan (khusus admin).
function hapusBalasan(u, id) {
  if (!u || u.role !== "admin")
    return [403, "Hanya pustakawan (admin) yang dapat menghapus balasan"];
  const r = db.reviews.find((x) => x.id === Number(id));
  if (!r) return [404, "Ulasan tidak ditemukan"];
  if (!r.reply) return [404, "Ulasan ini belum memiliki balasan"];
  delete r.reply;
  persist();
  return null;
}

// ---------- Tanya Pustakawan / Pusat Bantuan ----------
// Topik pesan yang boleh dipilih anggota.
const TOPIK = ["usul", "denda", "buku", "lain"];
const MAKS_PESAN = 2000;
const MAKS_PERCAKAPAN_TERBUKA = 10;
const sekarang = () => new Date().toISOString();
const idBaru = () => Date.now() + Math.floor(Math.random() * 1000);

// Percakapan + pesan yang boleh dilihat: anggota hanya miliknya, admin semuanya.
function threadsFor(u) {
  const th =
    u.role === "admin"
      ? db.threads
      : db.threads.filter((t) => t.userId === u.id);
  const ids = new Set(th.map((t) => t.id));
  const nama = (m) => {
    if (m.sender === "admin") {
      const a = db.users.find((x) => x.id === m.senderId);
      return "Pustakawan" + (a ? " · " + a.name.split(" ")[0] : "");
    }
    const w = db.users.find((x) => x.id === m.senderId);
    return w ? w.name : "Anggota";
  };
  return {
    threads: th,
    messages: db.messages
      .filter((m) => ids.has(m.threadId))
      .map((m) => ({ ...m, name: nama(m) })),
  };
}

// Anggota membuat percakapan baru: topik, judul, isi pesan (opsional: buku terkait).
function pesanBaru(u, body) {
  if (u.role === "admin") return "Admin membalas lewat Pesan Masuk";
  const topic = String(body.topic || "");
  const subject = String(body.subject || "").trim();
  const text = String(body.text || "").trim();
  const bookId = body.bookId ? Number(body.bookId) : null;
  if (!TOPIK.includes(topic)) return "Pilih topik pesan";
  if (subject.length < 3 || subject.length > 120)
    return "Judul pesan 3-120 karakter";
  if (!text || text.length > MAKS_PESAN)
    return `Isi pesan wajib diisi (maks ${MAKS_PESAN} karakter)`;
  if (bookId && !db.books.some((b) => b.id === bookId))
    return "Buku tidak ditemukan";
  if (
    db.threads.filter((t) => t.userId === u.id && t.status !== "Selesai")
      .length >= MAKS_PERCAKAPAN_TERBUKA
  )
    return `Maksimal ${MAKS_PERCAKAPAN_TERBUKA} percakapan aktif. Tandai selesai percakapan lama dulu`;
  const t = {
    id: idBaru(),
    userId: u.id,
    topic,
    subject,
    bookId,
    status: "Menunggu Balasan",
    created: sekarang(),
    updated: sekarang(),
    unreadUser: false,
    unreadAdmin: true,
  };
  db.threads.push(t);
  db.messages.push({
    id: idBaru(),
    threadId: t.id,
    sender: "user",
    senderId: u.id,
    text,
    time: t.created,
  });
  persist();
  return null;
}

// Cari percakapan yang boleh diakses (pemilik atau admin).
const ambilThread = (u, id) => {
  const t = db.threads.find((x) => x.id === Number(id));
  return t && (u.role === "admin" || t.userId === u.id) ? t : null;
};

// Balas percakapan. Balasan admin → status "Dibalas"; balasan anggota → "Menunggu Balasan" (membuka lagi yang selesai).
function balasPesan(u, body) {
  const t = ambilThread(u, body.threadId);
  if (!t) return "Percakapan tidak ditemukan";
  const text = String(body.text || "").trim();
  if (!text || text.length > MAKS_PESAN)
    return `Isi pesan wajib diisi (maks ${MAKS_PESAN} karakter)`;
  const admin = u.role === "admin";
  db.messages.push({
    id: idBaru(),
    threadId: t.id,
    sender: admin ? "admin" : "user",
    senderId: u.id,
    text,
    time: sekarang(),
  });
  Object.assign(
    t,
    admin
      ? {
          status: "Dibalas",
          unreadUser: true,
          unreadAdmin: false,
          updated: sekarang(),
        }
      : {
          status: "Menunggu Balasan",
          unreadAdmin: true,
          unreadUser: false,
          updated: sekarang(),
        },
  );
  persist();
  return null;
}

// Tandai sudah dibaca (sisi yang membuka) atau ubah status selesai / buka kembali.
function ubahThread(u, body) {
  const t = ambilThread(u, body.threadId);
  if (!t) return "Percakapan tidak ditemukan";
  if (body.read) {
    if (u.role === "admin") t.unreadAdmin = false;
    else t.unreadUser = false;
  }
  if (body.status === "Selesai") {
    t.status = "Selesai";
    t.unreadAdmin = false;
    t.updated = sekarang();
  }
  if (body.status === "Buka" && u.role === "admin") {
    t.status = "Dibalas";
    t.updated = sekarang();
  }
  persist();
  return null;
}

// Siapkan data untuk browser sesuai hak akses: tamu, anggota (data sendiri), atau admin (semua).
function stateFor(u) {
  expireBookings();
  const stats = {
    books: db.books.length,
    users: db.users.length,
    categories: db.categories.length,
    loans: db.loans.length,
  };
  const base = {
    meId: u ? u.id : null,
    books: db.books,
    categories: db.categories,
    stats,
    pickupDays: BATAS_AMBIL_HARI,
    reviews: publicReviews(),
  };
  // Semua alamat di bawah ini wajib login.
  if (!u) return { ...base, users: [], loans: [], threads: [], messages: [] };
  if (u.role === "admin")
    return {
      ...base,
      ...threadsFor(u),
      users: db.users.map(publicUser),
      loans: db.loans,
    };
  return {
    ...base,
    ...threadsFor(u),
    users: [publicUser(u)],
    loans: db.loans.filter((l) => l.userId === u.id),
  };
}

// Kolom profil yang boleh diubah user (tambahkan avatar).
const PROFILE_FIELDS = ["name", "email", "nim", "phone", "address", "avatar"];

// Perbarui profil; tolak jika email sudah dipakai akun lain.
function updateProfile(target, data) {
  const email = String(data.email || target.email)
    .trim()
    .toLowerCase();
  if (db.users.some((x) => x.id !== target.id && x.email === email))
    return "Email sudah dipakai akun lain";
  PROFILE_FIELDS.forEach((k) => {
    if (data[k] !== undefined) target[k] = String(data[k]).trim();
  });
  // Wishlist (Daftar Impian): hanya id buku yang benar-benar ada, tanpa duplikat, maks 100.
  if (Array.isArray(data.wishlist))
    target.wishlist = [...new Set(data.wishlist.map(Number))]
      .filter((id) => db.books.some((b) => b.id === id))
      .slice(0, 100);
  target.email = email;
  return null;
}

const AKTIF = ["Menunggu", "Siap Diambil", "Dipinjam"];

// Simpan gambar sampul base64 ke berkas fisik di folder public/covers
function saveCoverImage(dataUrl, bookId) {
  if (
    !dataUrl ||
    typeof dataUrl !== "string" ||
    !dataUrl.startsWith("data:image/")
  ) {
    return dataUrl;
  }
  const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  if (!matches) return dataUrl;
  let ext = matches[1].toLowerCase();
  if (ext === "jpeg") ext = "jpg";
  if (ext === "svg+xml") ext = "svg";
  const buffer = Buffer.from(matches[2], "base64");
  const filename = `cover-${bookId || Date.now()}-${Math.floor(Math.random() * 1e4)}.${ext}`;
  const dir = path.join(PUBLIC, "covers");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/covers/${filename}`;
}

// Simpan perubahan dari browser sesuai hak akses (admin: semua data, anggota: profil & pengajuan sendiri).
function applyChanges(u, body) {
  if (u.role === "admin") {
    if (Array.isArray(body.books)) {
      for (const b of body.books) {
        if (
          b.img &&
          typeof b.img === "string" &&
          b.img.startsWith("data:image/")
        ) {
          b.img = saveCoverImage(b.img, b.id);
        }
      }
      db.books = body.books;
    }

    if (Array.isArray(body.categories)) db.categories = body.categories;
    if (Array.isArray(body.loans)) db.loans = body.loans;
    if (Array.isArray(body.users)) {
      const keep = new Set(body.users.map((x) => x.id));
      db.users = db.users.filter((x) => x.role === "admin" || keep.has(x.id));
      for (const inc of body.users) {
        const t = db.users.find((x) => x.id === inc.id);
        if (!t) continue;
        if (t.id === u.id) {
          const err = updateProfile(t, inc);
          if (err) return err;
        } else if (t.role !== "admin") t.active = !!inc.active;
      }
    }
    bersihkanUlasan();
  } else {
    const inc = (body.users || []).find((x) => x.id === u.id);
    if (inc) {
      const err = updateProfile(u, inc);
      if (err) return err;
    }
    // anggota hanya boleh menambah pengajuan baru miliknya sendiri
    for (const l of body.loans || []) {
      if (db.loans.some((x) => x.id === l.id)) continue;
      const book = db.books.find((b) => b.id === l.bookId);
      if (!book) continue;
      const mine = db.loans.filter(
        (x) => x.userId === u.id && AKTIF.includes(x.status),
      );
      if (book.stock < 1) return "Stok buku ini sedang habis";
      if (mine.some((x) => x.bookId === book.id))
        return "Kamu sudah meminjam/mengajukan buku ini";
      if (mine.length >= MAKS_PINJAM_AKTIF)
        return `Maksimal ${MAKS_PINJAM_AKTIF} pinjaman aktif`;
      if (mine.some((x) => x.status === "Dipinjam" && x.due < today()))
        return "Kembalikan dulu buku yang terlambat";
      const days = Math.min(14, Math.max(1, +l.days || 7));
      db.loans.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        userId: u.id,
        bookId: l.bookId,
        days,
        date: today(),
        due: today(days),
        status: "Menunggu",
      });
    }
  }
  persist();
  return null;
}

// ---------- HTTP ----------
// Kirim balasan JSON ke browser.
const send = (res, code, obj, headers = {}) => {
  res.writeHead(code, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(obj));
};

// Baca isi request (JSON), batasi maksimal 10MB.
const readBody = (req) =>
  new Promise((ok, fail) => {
    let s = "";
    req.on("data", (c) => {
      s += c;
      if (s.length > 10e6) {
        fail(new Error("too big"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        ok(s ? JSON.parse(s) : {});
      } catch (e) {
        fail(e);
      }
    });
  });

// Jenis file (Content-Type) berdasarkan ekstensi.
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

// Buat cookie sesi HttpOnly (tidak bisa dibaca JavaScript browser).
let HTTPS = false; // diisi per request
const cookie = (t, age) =>
  `sid=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${HTTPS ? "; Secure" : ""}`;

// Batas salah login: 5 kali per email/IP, lalu dikunci 15 menit.
const gagal = new Map();
const kunci = (k) => {
  const g = gagal.get(k);
  return g && g.n >= 5 && Date.now() - g.t < 15 * 60e3;
};
const catatGagal = (k) => {
  const g = gagal.get(k);
  gagal.set(k, {
    n: g && Date.now() - g.t < 15 * 60e3 ? g.n + 1 : 1,
    t: Date.now(),
  });
};

// Router API: menangani semua alamat /api/...
async function api(req, res, url) {
  const u = getUser(req);
  if (req.method === "GET" && url === "/api/state")
    return send(res, 200, stateFor(u));
  // Balasan admin: POST/DELETE /api/reviews/:id/reply
  const balasanM = /^\/api\/reviews\/(\d+)\/reply$/.exec(url);
  if (req.method !== "POST" && !(balasanM && req.method === "DELETE"))
    return send(res, 405, { error: "Method tidak didukung" });
  const body = await readBody(req);

  // Daftar akun baru: validasi nama, email, NIM, password, lalu simpan ke database.
  if (url === "/api/register") {
    const email = String(body.email || "")
        .trim()
        .toLowerCase(),
      name = String(body.name || "").trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email))
      return send(res, 400, {
        error: "Nama dan email wajib diisi dengan benar",
      });
    if (!/^[A-Za-z0-9]{5,20}$/.test(body.nim || ""))
      return send(res, 400, { error: "NIM harus 5-20 huruf/angka" });
    if (String(body.password || "").length < 8)
      return send(res, 400, { error: "Password minimal 8 karakter" });
    if (db.users.some((x) => x.email === email))
      return send(res, 400, { error: "Email sudah terdaftar" });
    if (db.users.some((x) => x.nim === body.nim))
      return send(res, 400, { error: "NIM sudah terdaftar" });

    // SIMPAN KE MEMORI & MYSQL: phone dan address sekarang diambil dari body
    db.users.push({
      id: Date.now(),
      name,
      nim: body.nim,
      email,
      passwordHash: hashPassword(body.password),
      role: "user",
      phone: String(body.phone || "").trim(), // <-- AMBIL NO HP
      address: String(body.address || "").trim(), // <-- AMBIL ALAMAT
      active: true,
      created: today(),
    });
    persist(); // Sinkronisasi otomatis ke MySQL
    return send(res, 200, { ok: true });
  }

  // Login: cek email & password, buat token sesi lalu kirim sebagai cookie.
  if (url === "/api/login") {
    const key =
      String(body.email || "")
        .trim()
        .toLowerCase() +
      "|" +
      req.socket.remoteAddress;
    if (kunci(key))
      return send(res, 429, {
        error: "Terlalu banyak percobaan. Coba lagi 15 menit lagi",
      });
    const x = db.users.find(
      (v) =>
        v.email ===
        String(body.email || "")
          .trim()
          .toLowerCase(),
    );
    if (!x || !checkPassword(body.password, x.passwordHash)) {
      catatGagal(key);
      return send(res, 401, { error: "Email atau password salah" });
    }
    gagal.delete(key);
    if (!x.active)
      return send(res, 403, { error: "Akun Anda dinonaktifkan admin" });
    const t = crypto.randomBytes(32).toString("hex");
    sessions.set(t, { id: x.id, exp: Date.now() + SESSION_AGE });
    saveSessions();
    return send(
      res,
      200,
      { ok: true, role: x.role, name: x.name },
      { "Set-Cookie": cookie(t, 86400) },
    );
  }
  // Logout: hapus sesi dan cookie.
  if (url === "/api/logout") {
    const m = /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || "");
    if (m) {
      sessions.delete(m[1]);
      saveSessions();
    }
    return send(res, 200, { ok: true }, { "Set-Cookie": cookie("", 0) });
  }
  if (!u) return send(res, 401, { error: "Silakan masuk terlebih dahulu" });
  // Ganti password: wajib benar password lama, baru minimal 8 karakter.
  if (url === "/api/password") {
    if (!checkPassword(body.current, u.passwordHash))
      return send(res, 400, { error: "Password lama salah" });
    if (String(body.password || "").length < 8)
      return send(res, 400, { error: "Password baru minimal 8 karakter" });
    u.passwordHash = hashPassword(body.password);
    persist();
    return send(res, 200, { ok: true });
  }
  // Hapus akun sendiri: kembalikan stok buku yang dipegang, hapus data & sesinya.
  if (url === "/api/delete-me") {
    if (u.role === "admin")
      return send(res, 400, { error: "Akun admin tidak bisa dihapus" });
    db.loans
      .filter(
        (l) =>
          l.userId === u.id &&
          (l.status === "Dipinjam" || l.status === "Siap Diambil"),
      )
      .forEach((l) => {
        const b = db.books.find((x) => x.id === l.bookId);
        if (b) b.stock++;
      });
    db.users = db.users.filter((x) => x.id !== u.id);
    db.loans = db.loans.filter((l) => l.userId !== u.id);
    db.reviews = db.reviews.filter((r) => r.userId !== u.id);
    const milik = new Set(
      db.threads.filter((t) => t.userId === u.id).map((t) => t.id),
    );
    db.threads = db.threads.filter((t) => !milik.has(t.id));
    db.messages = db.messages.filter((m) => !milik.has(m.threadId));
    for (const [t, v] of sessions) if (v.id === u.id) sessions.delete(t);
    saveSessions();
    persist();
    return send(res, 200, { ok: true }, { "Set-Cookie": cookie("", 0) });
  }
  // Balasan Admin atas Ulasan (khusus admin; anggota biasa ditolak 403).
  if (balasanM) {
    const err =
      req.method === "DELETE"
        ? hapusBalasan(u, balasanM[1])
        : simpanBalasan(u, balasanM[1], body);
    return err
      ? send(res, err[0], { error: err[1] })
      : send(res, 200, stateFor(u));
  }
  // Ulasan & Rating: kirim/ubah ulasan sendiri.
  if (url === "/api/review") {
    const err = simpanUlasan(u, body);
    return err ? send(res, 400, { error: err }) : send(res, 200, stateFor(u));
  }
  // Hapus ulasan (milik sendiri, atau admin untuk moderasi).
  if (url === "/api/review-delete") {
    const err = hapusUlasan(u, body.id);
    return err ? send(res, 400, { error: err }) : send(res, 200, stateFor(u));
  }
  // Tanya Pustakawan: buat percakapan baru, balas, tandai dibaca/selesai.
  const PESAN = {
    "/api/msg/new": pesanBaru,
    "/api/msg/reply": balasPesan,
    "/api/msg/update": ubahThread,
  };
  if (PESAN[url]) {
    const err = PESAN[url](u, body);
    return err ? send(res, 400, { error: err }) : send(res, 200, stateFor(u));
  }
  // Simpan perubahan data dari browser.
  if (url === "/api/save") {
    const err = applyChanges(u, body);
    return err
      ? send(res, 400, { error: err, state: stateFor(u) })
      : send(res, 200, stateFor(u));
  }
  send(res, 404, { error: "Tidak ditemukan" });
}

// Server HTTP: alamat /api/ ke router API, selain itu kirim file statis (server.js & data.json disembunyikan).
const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = decodeURIComponent(req.url.split("?")[0]);
  } catch {
    res.writeHead(400);
    return res.end("Alamat tidak valid");
  }
  HTTPS =
    req.headers["x-forwarded-proto"] === "https" || !!req.socket.encrypted;
  try {
    if (url.startsWith("/api/")) return await api(req, res, url);
    const file = path.normalize(
      path.join(PUBLIC, url === "/" ? "index.html" : url),
    );
    // Hanya isi folder public/ yang bisa dibuka (data.json, server.js, .env aman).
    if (
      !file.startsWith(PUBLIC + path.sep) ||
      !fs.existsSync(file) ||
      fs.statSync(file).isDirectory()
    ) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
    });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: "Terjadi kesalahan server" });
  }
});
// Mulai: muat data dari MySQL dulu, baru server menerima pengunjung.
async function start() {
  try {
    db = await store.loadAll();
  } catch (e) {
    console.error(
      "Tidak bisa terhubung ke MySQL. Cek XAMPP (MySQL harus Start) dan isi DB_ di file .env.\n",
      e.message,
    );
    process.exit(1);
  }
  if (!db.users.length && !db.books.length) {
    // MySQL masih kosong: pindahkan isi data.json kalau ada, kalau tidak pakai data awal.
    if (fs.existsSync(DATA_FILE)) {
      db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      console.log("MySQL kosong: isi data.json dipindahkan ke MySQL.");
    } else {
      db = seed();
      console.log("MySQL kosong: data awal dimasukkan ke MySQL.");
    }
  }
  for (const k of ["reviews", "threads", "messages"])
    if (!Array.isArray(db[k])) db[k] = []; // data lama belum punya tabel ini
  gantiPasswordAdminBawaan();
  await persist();
  expireBookings();
  const port = process.env.PORT || PORT;
  server.listen(port, () =>
    console.log(
      `Libiverse berjalan di http://localhost:${port} (database: MySQL)`,
    ),
  );
}
start();
