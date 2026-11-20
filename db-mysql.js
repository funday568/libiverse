// Penghubung ke MySQL: membaca semua data saat server mulai, dan menyimpan perubahan.
// Tabel dibuat otomatis kalau belum ada, jadi cukup buat database kosong "libiverse".
const fs = require("fs");
const path = require("path");

// Baca .env (supaya file ini juga bisa dipakai sendiri, misal oleh migrasi.js).
try {
  for (const line of fs
    .readFileSync(path.join(__dirname, ".env"), "utf8")
    .split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined)
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const mysql = require("mysql2/promise");

const isTiDB =
  process.env.DB_SSL === "true" ||
  (process.env.DB_HOST && process.env.DB_HOST.includes("tidbcloud"));

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "libiverse",
  dateStrings: true,
  charset: "utf8mb4",
  ssl: isTiDB ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
});

// Kolom tiap tabel. Field lain yang tidak terdaftar (misal pickupBy) disimpan di kolom "extra".
const TABLES = {
  users: [
    "id",
    "name",
    "email",
    "passwordHash",
    "role",
    "nim",
    "phone",
    "address",
    "active",
    "created",
  ],
  books: [
    "id",
    "title",
    "author",
    "publisher",
    "year",
    "isbn",
    "cat",
    "stock",
    "img",
    "abstract",
    "synopsis",
  ],
  loans: ["id", "userId", "bookId", "days", "date", "due", "status"],
  // Ulasan & Rating: 1 ulasan per anggota per buku (rating 1-5 + teks ulasan).
  reviews: ["id", "userId", "bookId", "rating", "text", "date"],
  // Tanya Pustakawan: satu percakapan (threads) berisi banyak pesan (messages).
  threads: [
    "id",
    "userId",
    "topic",
    "subject",
    "bookId",
    "status",
    "created",
    "updated",
    "unreadUser",
    "unreadAdmin",
  ],
  messages: ["id", "threadId", "sender", "senderId", "text", "time"],
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY, name VARCHAR(150), email VARCHAR(190) UNIQUE, passwordHash VARCHAR(255),
    role VARCHAR(20), nim VARCHAR(50), phone VARCHAR(50), address TEXT, active TINYINT(1) DEFAULT 1,
    created VARCHAR(20), extra JSON NULL) CHARACTER SET utf8mb4`,
  `CREATE TABLE IF NOT EXISTS categories (name VARCHAR(100) PRIMARY KEY, urut INT) CHARACTER SET utf8mb4`,
  `CREATE TABLE IF NOT EXISTS books (
    id BIGINT PRIMARY KEY, title VARCHAR(255), author VARCHAR(255), publisher VARCHAR(255), year INT,
    isbn VARCHAR(50), cat VARCHAR(100), stock INT DEFAULT 0, img VARCHAR(255), abstract TEXT,
    synopsis TEXT, extra JSON NULL) CHARACTER SET utf8mb4`,
  `CREATE TABLE IF NOT EXISTS loans (
    id BIGINT PRIMARY KEY, userId BIGINT, bookId BIGINT, days INT, date VARCHAR(20), due VARCHAR(20),
    status VARCHAR(50), extra JSON NULL, INDEX (userId), INDEX (bookId)) CHARACTER SET utf8mb4`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id BIGINT PRIMARY KEY, userId BIGINT, bookId BIGINT, rating TINYINT, text TEXT, date VARCHAR(20),
    extra JSON NULL, INDEX (userId), INDEX (bookId)) CHARACTER SET utf8mb4`,
  `CREATE TABLE IF NOT EXISTS threads (
    id BIGINT PRIMARY KEY, userId BIGINT, topic VARCHAR(20), subject VARCHAR(150), bookId BIGINT NULL,
    status VARCHAR(30), created VARCHAR(30), updated VARCHAR(30), unreadUser TINYINT(1) DEFAULT 0,
    unreadAdmin TINYINT(1) DEFAULT 0, extra JSON NULL, INDEX (userId)) CHARACTER SET utf8mb4`,
  `CREATE TABLE IF NOT EXISTS messages (
    id BIGINT PRIMARY KEY, threadId BIGINT, sender VARCHAR(10), senderId BIGINT, text TEXT, time VARCHAR(30),
    extra JSON NULL, INDEX (threadId)) CHARACTER SET utf8mb4`,
];

async function init() {
  for (const q of SCHEMA) await pool.query(q);
}

function fromRow(table, row) {
  const o = {};
  for (const c of TABLES[table])
    if (row[c] !== null && row[c] !== undefined) o[c] = row[c];
  if (table === "users") o.active = !!row.active;
  if (table === "threads") {
    o.unreadUser = !!row.unreadUser;
    o.unreadAdmin = !!row.unreadAdmin;
  }
  if (row.extra)
    Object.assign(
      o,
      typeof row.extra === "string" ? JSON.parse(row.extra) : row.extra,
    );
  return o;
}

// Ambil semua data → bentuknya sama persis seperti isi data.json dulu.
async function loadAll() {
  await init();
  const db = {
    users: [],
    categories: [],
    books: [],
    loans: [],
    reviews: [],
    threads: [],
    messages: [],
  };
  for (const t of Object.keys(TABLES)) {
    const [rows] = await pool.query(`SELECT * FROM ${t} ORDER BY id`);
    db[t] = rows.map((r) => fromRow(t, r));
  }
  const [cats] = await pool.query(
    "SELECT name FROM categories ORDER BY urut, name",
  );
  db.categories = cats.map((r) => r.name);
  return db;
}

// Simpan semua data dalam satu transaksi (kalau gagal di tengah, tidak ada yang berubah).
async function saveAll(db) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const t of Object.keys(TABLES)) {
      const cols = TABLES[t];
      const list = db[t] || [];
      if (list.length) {
        const rows = list.map((o) => {
          const extra = {};
          for (const k of Object.keys(o))
            if (!cols.includes(k)) extra[k] = o[k];
          return [
            ...cols.map((c) =>
              o[c] === undefined
                ? null
                : typeof o[c] === "boolean"
                  ? o[c]
                    ? 1
                    : 0
                  : o[c],
            ),
            Object.keys(extra).length ? JSON.stringify(extra) : null,
          ];
        });
        const all = [...cols, "extra"];
        await conn.query(
          `INSERT INTO ${t} (${all.join(",")}) VALUES ? ON DUPLICATE KEY UPDATE ` +
            all
              .filter((c) => c !== "id")
              .map((c) => `${c}=VALUES(${c})`)
              .join(","),
          [rows],
        );
        await conn.query(`DELETE FROM ${t} WHERE id NOT IN (?)`, [
          list.map((o) => o.id),
        ]);
      } else {
        await conn.query(`DELETE FROM ${t}`);
      }
    }
    await conn.query("DELETE FROM categories");
    const cats = db.categories || [];
    if (cats.length)
      await conn.query("INSERT INTO categories (name, urut) VALUES ?", [
        cats.map((c, i) => [c, i]),
      ]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { pool, init, loadAll, saveAll };
