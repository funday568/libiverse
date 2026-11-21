// ===== storage.js =====
// Koneksi ke server + helper umum.
// Singkatan untuk mengambil satu elemen HTML (mirip jQuery).
const $ = (s) => document.querySelector(s);

// Besar denda keterlambatan per hari (Rupiah).
const DENDA_PER_HARI = 1000;

// Tanggal hari ini (+d hari) dalam format YYYY-MM-DD, dipakai untuk tanggal pinjam/kembali.
function today(d = 0) {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
}
// Data diambil dari server (server.js). Password TIDAK pernah dikirim ke browser.
// Wadah data di browser; isinya diisi dari server lewat loadState().
let db = {
  users: [],
  books: [],
  categories: [],
  loans: [],
  reviews: [],
  threads: [],
  messages: [],
  stats: {},
  meId: null,
  pickupDays: 2,
};

// Kirim request ke server (GET jika tanpa body, POST jika ada body). Lempar error jika gagal.
async function api(url, body) {
  const r = await fetch(
    url,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await r
    .json()
    .catch(() => ({ error: "Server tidak merespons" }));
  if (!r.ok) throw Object.assign(new Error(data.error || "Gagal"), { data });
  return data;
}

// Ambil seluruh data terbaru (buku, pinjaman, user) dari server.
async function loadState() {
  db = await api("/api/state");
}
// Kirim perubahan ke server; server memeriksa hak akses. Return pesan error atau null.
async function save() {
  try {
    db = await api("/api/save", {
      books: db.books,
      categories: db.categories,
      loans: db.loans,
      users: db.users,
    });
  } catch (e) {
    if (e.data && e.data.state) db = e.data.state;
    else await loadState().catch(() => {});
    me = currentUser();
    return e.message;
  }
  me = currentUser();
  return null;
}

// Titik awal setiap halaman: muat data dulu, lalu tampilkan halaman (render).
// Error server dan error tampilan dibedakan, supaya pesan "Server tidak berjalan"
// tidak muncul padahal masalahnya ada di JavaScript halaman.
function boot() {
  loadState().then(
    () => {
      me = currentUser();
      try {
        render();
      } catch (e) {
        console.error("Gagal menampilkan halaman:", e);
        document.body.innerHTML = `<p style='padding:30px'>Terjadi kesalahan saat menampilkan halaman.<br>
          <small style="color:#b91c1c">Detail: ${esc((e && e.message) || String(e))}</small><br><br>
          Coba muat ulang halaman (Ctrl+F5). Detail lengkap ada di Console (F12).</p>`;
      }
    },
    (e) => {
      console.error("Gagal memuat data dari server:", e);
      document.body.innerHTML =
        "<p style='padding:30px'>Server tidak berjalan. Jalankan <b>node server.js</b> lalu buka http://localhost:3000</p>";
    },
  );
}

// Pesan notifikasi antar halaman
let flash = sessionStorage.getItem("libiverse_flash") || "";
sessionStorage.removeItem("libiverse_flash");
window.addEventListener("pagehide", () => {
  if (flash) sessionStorage.setItem("libiverse_flash", flash);
});

// esc: amankan teks agar tidak dieksekusi sebagai HTML (mencegah XSS).
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

// rp: format angka jadi Rupiah, contoh 5000 → Rp5.000.
const rp = (n) => "Rp" + n.toLocaleString("id-ID");

// Warna sampul cadangan untuk buku yang belum punya gambar.
const colors = [
  "#5b5bd6",
  "#c2410c",
  "#0f766e",
  "#7c4dcc",
  "#be123c",
  "#1d4ed8",
];

// Atur sampul buku: pakai gambar jika ada, kalau tidak pakai warna.
const cover = (b) =>
  b.img
    ? `style="background-image:url('${b.img}')"`
    : `style="background:${colors[b.id % colors.length]}"`;

// Pemetaan status peminjaman → warna label (tag).
const STATUS_CLS = {
  Menunggu: "warn",
  "Siap Diambil": "warn",
  Dipinjam: "",
  Dikembalikan: "ok",
  Ditolak: "bad",
  "Booking Kedaluwarsa": "bad",
};

// Hitung berapa hari buku yang sedang dipinjam sudah lewat tanggal kembali.
const lateDays = (l) => {
  if (l.status !== "Dipinjam") return 0;
  const d = Math.floor((new Date(today()) - new Date(l.due)) / 864e5);
  return d > 0 ? d : 0;
};

// Hitung denda: denda tersimpan jika sudah dikembalikan, atau hari terlambat × denda/hari.
const fine = (l) =>
  l.status === "Dikembalikan" ? l.fine || 0 : lateDays(l) * DENDA_PER_HARI;

// Tampilkan pesan notifikasi sekali lalu hapus (awalan "!" = pesan error/merah).
const flashHTML = () => {
  const f = flash;
  flash = "";
  return f
    ? `<div class="alert ${f.startsWith("!") ? "err" : ""}">${esc(f.replace(/^!/, ""))}</div>`
    : "";
};

// Tutup jendela pop-up (modal).
const closeModal = () => ($("#modal").innerHTML = "");

// ===== Validasi data diri (daftar & profil). Server tetap memeriksa ulang. =====
// No HP: buang spasi/tanda, +62/62 → 0. Valid: 08xxxxxxxx (10-13 digit).
const normPhone = (p) =>
  String(p ?? "").replace(/[\s\-().]/g, "").replace(/^\+?62/, "0");

// Cek kolom (default: email, NIM, No HP). Hasil: [nama kolom, pesan] untuk kolom pertama yang salah, atau null.
const KONTAK = {
  email: [(v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()), "Format email tidak valid, contoh: nama@email.com"],
  nim: [(v) => /^[A-Za-z0-9]{5,20}$/.test(v.trim()), "NIM harus 5-20 huruf/angka"],
  phone: [(v) => /^08\d{8,11}$/.test(normPhone(v)), "Nomor HP tidak valid. Gunakan format 08xxxxxxxxxx (10-13 digit)"],
};
function cekKontak(f, keys = Object.keys(KONTAK)) {
  const k = keys.find((k) => !KONTAK[k][0](String(f[k] ?? "")));
  return k ? [k, KONTAK[k][1]] : null;
}

// Tampilkan pesan error langsung di kolom form (isi form tidak hilang).
function fieldError(form, name, msg) {
  const el = form.elements[name];
  if (!el) return false;
  el.setCustomValidity(msg);
  el.reportValidity();
  el.addEventListener("input", () => el.setCustomValidity(""), { once: true });
  return true;
}

// Buku per halaman = kelipatan jumlah kolom grid (minimal 12), jadi baris terakhir selalu penuh.
// Contoh: 7 kolom → 14, 6 → 12, 5 → 15, 4 → 12, 3 → 12, 2 → 12.
function perPageFor(sel, min = 12) {
  const g = document.querySelector(sel);
  const cols = g ? getComputedStyle(g).gridTemplateColumns.split(" ").length : 0;
  return cols ? cols * Math.ceil(min / cols) : min;
}

// ===== Paginasi bersama (beranda & katalog anggota) =====
// Nomor halaman yang ditampilkan: halaman pertama, terakhir, dan halaman di sekitar halaman aktif.
// Contoh (aktif 6 dari 42): 1 … 4 5 6 7 8 … 42
function pageNumbers(cur, total) {
  const r = window.innerWidth < 520 ? 1 : 2; // layar HP: lebih sedikit tombol agar muat 1 baris
  const set = new Set([1, total]);
  for (let i = cur - r; i <= cur + r; i++) if (i >= 1 && i <= total) set.add(i);
  const nums = [...set].sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] === 2) out.push(n - 1); // celah 1 halaman: tampilkan angkanya saja
    else if (i && n - nums[i - 1] > 2) out.push("…");
    out.push(n);
  });
  return out;
}

// Susun HTML paginasi. fn = nama fungsi global yang dipanggil dengan nomor halaman tujuan.
function pagerHTML(cur, total, count, fn) {
  if (total <= 1) return "";
  const btn = (p, label, title, extra = "") =>
    `<button type="button" class="pg-btn ${extra}" ${p < 1 || p > total || p === cur ? "disabled" : ""} onclick="${fn}(${p})" title="${title}">${label}</button>`;
  return `<nav class="pagination" aria-label="Navigasi halaman">
    <div class="pg-nums">
      ${btn(1, "«", "Halaman pertama", "pg-edge pg-end")}
      ${btn(cur - 1, "‹", "Sebelumnya", "pg-edge")}
      ${pageNumbers(cur, total)
        .map((n) =>
          n === "…"
            ? `<span class="pg-gap">…</span>`
            : `<button type="button" class="pg-btn ${n === cur ? "on" : ""}" ${n === cur ? 'aria-current="page"' : ""} onclick="${fn}(${n})">${n}</button>`,
        )
        .join("")}
      ${btn(cur + 1, "›", "Selanjutnya", "pg-edge")}
      ${btn(total, "»", "Halaman terakhir", "pg-edge pg-end")}
    </div>
    <form class="pg-jump" onsubmit="event.preventDefault();const v=parseInt(this.p.value,10);if(v>=1&&v<=${total})${fn}(v);else{this.p.value='';this.p.focus();}">
      <span class="page-info">Halaman <b>${cur}</b> dari <b>${total}</b> (${count} buku)</span>
      <label>Ke halaman <input name="p" type="number" min="1" max="${total}" inputmode="numeric" placeholder="${cur}"></label>
      <button type="submit" class="pg-btn pg-go">Buka</button>
    </form>
  </nav>`;
}

// Navigasi antar halaman
// Daftar nama halaman → file HTML-nya.
const PAGES = {
  home: "index.html",
  login: "login.html",
  register: "register.html",
  catalog: "user.html#catalog",
  wishlist: "user.html#wishlist",
  borrowing: "user.html#borrowing",
  profile: "user.html#profile",
  help: "user.html#help",
  admin: "admin.html#dashboard",
};

// Pindah halaman: buka file lain, ganti hash (#), atau render ulang halaman yang sama.
function go(h) {
  const target = h.startsWith("admin/")
    ? "admin.html#" + h.slice(6)
    : PAGES[h] || "index.html";
  const [file, hash] = target.split("#");
  const cur = location.pathname.split("/").pop() || "index.html";
  if (cur !== file) return (location.href = target);
  if (hash === undefined || location.hash.slice(1) === hash) render();
  else location.hash = hash;
}

// ===== Ulasan & Rating =====
// Ulasan satu buku, terbaru di atas.
const reviewsOf = (id) =>
  (db.reviews || [])
    .filter((r) => r.bookId === id)
    .sort(
      (a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id,
    );

// Rata-rata rating & jumlah ulasan sebuah buku. Contoh: { avg: 4.8, n: 12 }
function ratingOf(id) {
  const rs = reviewsOf(id),
    n = rs.length;
  return { n, avg: n ? rs.reduce((s, r) => s + r.rating, 0) / n : 0 };
}

// Deretan bintang, contoh 4 → ★★★★☆
const starsHTML = (v) => {
  const k = Math.round(v);
  return `<span class="stars" aria-label="${k} dari 5 bintang">${"★".repeat(k)}<i>${"☆".repeat(5 - k)}</i></span>`;
};

// Label rating di kartu buku, contoh: ⭐ 4.8 (12)
const ratingBadge = (id) => {
  const { n, avg } = ratingOf(id);
  return n
    ? `<span class="rate" title="Rata-rata dari ${n} ulasan">⭐ ${avg.toFixed(1)} <em>(${n})</em></span>`
    : `<span class="rate none">☆ Belum ada rating</span>`;
};

const RATING_LABEL = ["", "Buruk", "Kurang", "Cukup", "Bagus", "Luar Biasa"];

// Bagian "Ulasan Pembaca" di jendela detail: ringkasan rating + daftar ulasan.
// manage = true → tampilkan tombol hapus (ulasan sendiri, atau semua ulasan untuk admin).
function reviewsHTML(id, manage) {
  const rs = reviewsOf(id),
    { n, avg } = ratingOf(id);
  const bar = (k) => {
    const c = rs.filter((r) => r.rating === k).length;
    return `<div class="rv-bar"><span>${k}★</span><div><i style="width:${n ? (c / n) * 100 : 0}%"></i></div><small>${c}</small></div>`;
  };
  const canDel = (r) =>
    manage && me && (r.userId === me.id || me.role === "admin");
  return `<div class="rv-sum"><div class="rv-avg"><b>${n ? avg.toFixed(1) : "–"}</b>${starsHTML(avg)}<small>${n ? n + " ulasan" : "Belum ada ulasan"}</small></div>
   <div class="rv-bars">${[5, 4, 3, 2, 1].map(bar).join("")}</div></div>
   ${
     rs.length
       ? `<div class="rv-list">${rs
           .map(
             (
               r,
             ) => `<div class="rv-item ${me && r.userId === me.id ? "mine" : ""}">
     <div class="rv-head"><span class="rv-ava">${esc(r.name[0] || "?")}</span><div><b>${esc(r.name)}${me && r.userId === me.id ? " <span class='tag'>Kamu</span>" : ""}</b><br>${starsHTML(r.rating)} <small>${esc(r.date)}</small></div>
     ${canDel(r) ? `<button class="btn sm out rv-del" title="Hapus ulasan" onclick="delReview(${r.id}, ${id})">🗑</button>` : ""}</div>
     ${r.text ? `<p>${esc(r.text)}</p>` : ""}${replyHTML(r)}</div>`,
           )
           .join("")}</div>`
       : `<p class="txt"><i>Belum ada ulasan. Jadilah pembaca pertama yang memberi ulasan!</i></p>`
   }`;
}

// ===== Balasan Pustakawan =====
// Format tanggal YYYY-MM-DD → "10 Nov 2026"
const fmtDate = (d) => {
  const x = new Date(d + "T00:00:00");
  return isNaN(x)
    ? esc(d)
    : x.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

// Kartu "Tanggapan Pustakawan": tampil menjorok di bawah ulasan, bergaya kartu katalog dengan stempel.
function replyHTML(r) {
  const p = r && r.reply;
  if (!p || !p.text) return "";
  return `<div class="rv-reply" role="note" aria-label="Tanggapan Pustakawan">
    <span class="rv-stamp" aria-hidden="true">LIBIVERSE<br><b>✒</b><br>${esc(
      String(p.date || "")
        .slice(0, 7)
        .replace("-", "·"),
    )}</span>
    <div class="rv-reply-head"><span class="badge-lib">📚 Tanggapan Pustakawan</span><small>${esc(p.adminName || "Pustakawan")} · ${fmtDate(p.date)}${p.edited ? " · disunting" : ""}</small></div>
    <p>${esc(p.text)}</p></div>`;
}

// Kirim / hapus balasan admin. Mengembalikan state terbaru dari server.
async function apiReply(id, text) {
  return api(`/api/reviews/${id}/reply`, { text });
}
async function apiReplyDelete(id) {
  const r = await fetch(`/api/reviews/${id}/reply`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const data = await r
    .json()
    .catch(() => ({ error: "Server tidak merespons" }));
  if (!r.ok) throw Object.assign(new Error(data.error || "Gagal"), { data });
  return data;
}

// Hapus ulasan lewat server, lalu halaman memperbarui tampilannya lewat onReviewChange().
async function delReview(rid, bookId) {
  if (!confirm("Hapus ulasan ini?")) return;
  let msg = "Ulasan dihapus";
  try {
    db = await api("/api/review-delete", { id: rid });
    me = currentUser();
  } catch (e) {
    msg = "!" + e.message;
  }
  if (typeof onReviewChange === "function") onReviewChange(bookId, msg);
}

// ===== Tanya Pustakawan / Pusat Bantuan =====
// Topik pesan anggota → label yang tampil.
const TOPIK = {
  usul: "📗 Usul Buku Baru",
  denda: "💰 Kendala Denda",
  buku: "📖 Pertanyaan Seputar Buku",
  lain: "💬 Lainnya",
};
// Warna label status percakapan.
const THREAD_CLS = { "Menunggu Balasan": "warn", Dibalas: "", Selesai: "ok" };

// Format waktu ISO → "10 Nov 2026, 10.08"
const fmtTime = (t) => {
  const d = new Date(t);
  return isNaN(d)
    ? esc(t)
    : d.toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

// Pesan-pesan dalam satu percakapan, urut dari yang terlama.
const msgsOf = (id) =>
  (db.messages || [])
    .filter((m) => m.threadId === id)
    .sort(
      (a, b) => String(a.time).localeCompare(String(b.time)) || a.id - b.id,
    );

// Percakapan terbaru di atas.
const sortThreads = (list) =>
  list
    .slice()
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated)));

// Gelembung chat. mine = "user" (anggota melihat) atau "admin" (admin melihat) → pesan sendiri di kanan.
function chatHTML(t, mine) {
  const book = t.bookId && db.books.find((b) => b.id === t.bookId);
  return `${book ? `<div class="chat-book">📖 Buku terkait: <b>${esc(book.title)}</b> — ${esc(book.author)}</div>` : ""}
   <div class="chat" id="chatBox">${msgsOf(t.id)
     .map(
       (
         m,
       ) => `<div class="bub ${m.sender === mine ? "me" : "them"} from-${m.sender}">
    <small class="who">${m.sender === "admin" ? "🧑‍💼 " : "👤 "}${esc(m.name)}</small><p>${esc(m.text)}</p><small class="when">${fmtTime(m.time)}</small></div>`,
     )
     .join("")}</div>`;
}

// Draf balasan disimpan sementara agar tidak hilang saat halaman diperbarui otomatis.
const drafts = {};
const draftInput = (key, el) => {
  drafts[key] = el.value;
};
const scrollChat = () => {
  const c = $("#chatBox");
  if (c) c.scrollTop = c.scrollHeight;
};

// ===== Toggle Intip Password (Show / Hide Password) =====
const EYE_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function togglePwd(btn) {
  const wrap = btn.closest(".pwd-wrap");
  if (!wrap) return;
  const input = wrap.querySelector("input");
  if (!input) return;
  const isPwd = input.type === "password";
  input.type = isPwd ? "text" : "password";
  btn.innerHTML = isPwd ? EYE_OFF_ICON : EYE_ICON;
  const tip = isPwd ? "Sembunyikan password" : "Lihat password";
  btn.setAttribute("aria-label", tip);
  btn.setAttribute("title", tip);
}
