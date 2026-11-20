// ===== auth.js =====
// Sesi login dikelola server (cookie HttpOnly). Browser hanya tahu siapa yang login.
// Elemen utama tempat seluruh tampilan halaman dimasukkan.
const app = $("#app");

// Data user yang sedang login (null jika belum login).
let me = null;

// Cari data user yang sedang login berdasarkan meId dari server.
function currentUser() { return db.users.find(u => u.id === db.meId) || null; }

// Keluar: hapus sesi di server lalu kembali ke beranda.
async function logout() { await api("/api/logout", {}).catch(() => {}); go("home"); }
// Panggil di awal halaman yang butuh login. role: "user" | "admin"
function requireLogin(role) {
  me = currentUser();
  if (!me || (role === "admin" && me.role !== "admin")) { location.href = "login.html"; return false; }
  return true;
}
