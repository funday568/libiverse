// Atur ulang password akun admin di MySQL memakai ADMIN_PASSWORD dari file .env.
// Jalankan: node reset-admin.js   (matikan dulu server.js)
const crypto = require("crypto");
const { pool } = require("./db-mysql");
(async () => {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) { console.error("Isi dulu ADMIN_PASSWORD di file .env"); process.exit(1); }
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = `scrypt$${salt}$${crypto.scryptSync(pw, salt, 64).toString("hex")}`;
  const [r] = await pool.query("UPDATE users SET passwordHash=? WHERE role='admin'", [hash]);
  console.log(`Password ${r.affectedRows} akun admin sekarang: ${pw}`);
  process.exit(0);
})().catch((e) => { console.error("Gagal:", e.message); process.exit(1); });
