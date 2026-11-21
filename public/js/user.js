// ===== user.js =====
// Area anggota: katalog, peminjaman, profil.
// Navbar area anggota (Katalog, Peminjaman, Profil) dengan menu aktif digarisbawahi.
function userNav(on) {
  const a = (h, t) =>
    `<a onclick="go('${h}')" style="${on === h ? "text-decoration:underline" : ""}">${t}</a>`;
  return `<nav class="top grad"><b class="logo">📚 Libiverse</b><div class="links">${a("home", "Beranda")}${a("catalog", "Katalog")}${a("wishlist", "❤️ Daftar Impian" + (wl().length ? ` (${wl().length})` : ""))}${a("borrowing", "Peminjaman")}${a("help", "💬 Tanya Pustakawan" + (unreadThreads() ? ` <span class="pill">${unreadThreads()}</span>` : ""))}${a("profile", "👤 " + esc(me.name))}${bellHTML()}<a onclick="logout()">Keluar</a></div></nav>`;
}

let userCatPage = 1;
let userCatPerPage = 12; // disesuaikan otomatis dengan jumlah kolom (lihat perPageFor)

// Saat ukuran jendela berubah (jumlah kolom berubah), hitung ulang jumlah per halaman.
let _rzCat;
addEventListener("resize", () => {
  clearTimeout(_rzCat);
  _rzCat = setTimeout(() => {
    if ($("#q") && $(".books") && perPageFor(".books") !== userCatPerPage) catalog();
  }, 200);
});

function changeUserCatPage(p) {
  userCatPage = p;
  catalog();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Halaman katalog: daftar buku yang bisa dicari (judul/penulis/ISBN) dan difilter kategori dengan paginasi.
// fit=false dipakai saat render ulang untuk menyesuaikan jumlah per halaman (mencegah render berulang).
function catalog(fit = true) {
  const q = (window._q || "").toLowerCase(),
    c = window._c || "",
    s = window._s || "";
  const list = db.books.filter(
    (b) =>
      (!c || b.cat === c) &&
      (b.title + b.author + b.isbn).toLowerCase().includes(q),
  );
  if (s === "rating")
    list.sort(
      (x, y) =>
        ratingOf(y.id).avg - ratingOf(x.id).avg ||
        ratingOf(y.id).n - ratingOf(x.id).n,
    );
  if (s === "ulasan")
    list.sort(
      (x, y) =>
        ratingOf(y.id).n - ratingOf(x.id).n ||
        ratingOf(y.id).avg - ratingOf(x.id).avg,
    );

  const totalPages = Math.ceil(list.length / userCatPerPage) || 1;
  if (userCatPage > totalPages) userCatPage = 1;
  if (userCatPage < 1) userCatPage = 1;
  const start = (userCatPage - 1) * userCatPerPage;
  const paged = list.slice(start, start + userCatPerPage);

  const pagHTML = pagerHTML(userCatPage, totalPages, list.length, "changeUserCatPage");

  app.innerHTML =
    userNav("catalog") +
    `<div class="wrap">${flashHTML()}
   <div class="banner grad"><div><h2>📖 Katalog Buku</h2><p>Temukan buku favoritmu</p></div></div>
   <div class="row"><input id="q" placeholder="Cari judul, penulis, ISBN..." value="${esc(window._q || "")}">
   <select id="c" style="max-width:200px"><option value="">Semua Kategori</option>${db.categories.map((x) => `<option ${x === c ? "selected" : ""}>${x}</option>`).join("")}</select>
   <select id="s" style="max-width:220px"><option value="">Urutan Bawaan</option><option value="rating" ${s === "rating" ? "selected" : ""}>⭐ Rating Tertinggi</option><option value="ulasan" ${s === "ulasan" ? "selected" : ""}>💬 Paling Banyak Diulas</option></select></div>
   <h3 style="margin-bottom:12px">Semua Buku <span class="tag">${list.length} buku</span></h3>
   <div class="books">${
     paged
       .map(
         (
           b,
         ) => `<div class="book"><div class="cv" ${cover(b)}>${b.img ? "" : esc(b.title)}${heartBtn(b.id)}</div><div class="in">
     <span class="tag">${esc(b.cat)}</span><h4>${esc(b.title)}</h4>${ratingBadge(b.id)}<small>${esc(b.author)} · Stok ${b.stock}</small>
     <div class="acts"><button class="btn sm out" onclick="detail(${b.id})">👁 Lihat Detail</button><button class="btn sm" ${b.stock < 1 ? "disabled" : ""} onclick="quickBorrow(${b.id})">📥 Pinjam</button></div></div></div>`,
       )
       .join("") || "<p>Tidak ada buku.</p>"
   }</div>${pagHTML}</div>`;

  $("#q").oninput = (e) => {
    window._q = e.target.value;
    userCatPage = 1;
    catalog();
    $("#q").focus();
    $("#q").setSelectionRange(99, 99);
  };
  $("#c").onchange = (e) => {
    window._c = e.target.value;
    userCatPage = 1;
    catalog();
  };
  $("#s").onchange = (e) => {
    window._s = e.target.value;
    userCatPage = 1;
    catalog();
  };
  // Penuhi baris terakhir: jumlah per halaman = kelipatan jumlah kolom yang tampil.
  const per = perPageFor(".books");
  if (fit && per !== userCatPerPage) {
    userCatPage = Math.floor(start / per) + 1; // tetap di sekitar buku yang sedang dilihat
    userCatPerPage = per;
    catalog(false);
  }
}

// ===== Notifikasi Peminjaman =====
// Notifikasi dihitung dari status pinjaman terbaru. Yang sudah dibaca dicatat di browser per akun.
const NOTIF_KEY = () => "libiverse_notif_read_" + me.id;
const readSet = () =>
  new Set(JSON.parse(localStorage.getItem(NOTIF_KEY()) || "[]"));
const dayDiff = (d) => Math.round((new Date(d) - new Date(today())) / 864e5);

function notifications() {
  const out = [];
  for (const l of db.loans.filter((x) => x.userId === me.id)) {
    const t = esc(
      (db.books.find((b) => b.id === l.bookId) || {}).title || "Buku",
    );
    if (l.status === "Siap Diambil") {
      out.push({
        key: l.id + ":ok",
        icon: "✅",
        cls: "ok",
        text: `Peminjaman <b>${t}</b> disetujui admin. Silakan ambil di perpustakaan${l.pickupBy ? " sebelum <b>" + l.pickupBy + "</b>" : ""}.`,
      });
      if (l.pickupBy && dayDiff(l.pickupBy) <= 1)
        out.push({
          key: l.id + ":pick:" + today(),
          icon: "⏰",
          cls: "warn",
          text: `Batas ambil <b>${t}</b> ${dayDiff(l.pickupBy) <= 0 ? "hari ini" : "besok"}! Booking otomatis kedaluwarsa jika tidak diambil.`,
        });
    } else if (l.status === "Ditolak")
      out.push({
        key: l.id + ":no",
        icon: "❌",
        cls: "bad",
        text: `Permohonan pinjam <b>${t}</b> ditolak admin.`,
      });
    else if (l.status === "Dikembalikan" && !myReview(l.bookId))
      out.push({
        key: l.id + ":rev",
        icon: "⭐",
        cls: "ok",
        text: `Sudah selesai membaca <b>${t}</b>? Beri rating & ulasan untuk membantu pembaca lain. <a onclick="openReview(${l.bookId})">Tulis ulasan →</a>`,
      });
    else if (l.status === "Booking Kedaluwarsa")
      out.push({
        key: l.id + ":exp",
        icon: "⌛",
        cls: "bad",
        text: `Booking <b>${t}</b> kedaluwarsa karena tidak diambil tepat waktu.`,
      });
    else if (l.status === "Dipinjam") {
      const d = dayDiff(l.due);
      if (d < 0)
        out.push({
          key: l.id + ":late:" + today(),
          icon: "🚨",
          cls: "bad",
          text: `<b>${t}</b> terlambat ${-d} hari. Denda saat ini ${rp(fine(l))}. Segera kembalikan!`,
        });
      else if (d <= 2)
        out.push({
          key: l.id + ":due:" + today(),
          icon: "📅",
          cls: "warn",
          text: `Jatuh tempo <b>${t}</b> ${d === 0 ? "hari ini" : d === 1 ? "besok" : "2 hari lagi"} (${l.due}). Kembalikan agar terhindar dari denda.`,
        });
    }
  }
  // Balasan baru dari pustakawan.
  for (const th of (db.threads || []).filter((x) => x.unreadUser)) {
    const last = msgsOf(th.id)
      .filter((m) => m.sender === "admin")
      .pop();
    if (last)
      out.push({
        key: "msg:" + last.id,
        icon: "💬",
        cls: "",
        text: `Pustakawan membalas pesanmu <b>${esc(th.subject)}</b>. <a onclick="openThread(${th.id})">Lihat balasan →</a>`,
      });
  }
  // Tanggapan pustakawan atas ulasan milik anggota.
  for (const r of (db.reviews || []).filter(
    (x) => x.userId === me.id && x.reply,
  )) {
    const t = esc(
      (db.books.find((b) => b.id === r.bookId) || {}).title || "Buku",
    );
    out.push({
      key: `reply:${r.id}:${r.reply.date}:${r.reply.text.length}`,
      icon: "📚",
      cls: "ok",
      text: `Pustakawan menanggapi ulasanmu untuk <b>${t}</b>. <a onclick="openReview(${r.bookId})">Lihat tanggapan →</a>`,
    });
  }
  return out.reverse();
}

function bellHTML() {
  const seen = readSet(),
    n = notifications().filter((x) => !seen.has(x.key)).length;
  return `<a class="bell" id="bell" onclick="toggleNotif(event)" title="Notifikasi">🔔${n ? `<span class="dot">${n > 9 ? "9+" : n}</span>` : ""}</a>`;
}

function toggleNotif(e) {
  e && e.stopPropagation();
  const old = $("#notifPanel");
  if (old) return old.remove();
  const seen = readSet(),
    list = notifications();
  const p = document.createElement("div");
  p.id = "notifPanel";
  p.className = "notif-panel card";
  p.onclick = (ev) => ev.stopPropagation();
  p.innerHTML = `<h4>🔔 Notifikasi</h4>${list.length ? list.map((x) => `<div class="notif ${x.cls} ${seen.has(x.key) ? "" : "new"}"><span>${x.icon}</span><p>${x.text}</p></div>`).join("") : `<p class="txt" style="padding:14px 0">Belum ada notifikasi.</p>`}
   <button class="btn sm out" style="width:100%;margin-top:8px" onclick="document.getElementById('notifPanel').remove();go('borrowing')">Lihat Peminjaman Saya</button>`;
  document.body.appendChild(p);
  localStorage.setItem(
    NOTIF_KEY(),
    JSON.stringify(
      [...new Set([...seen, ...list.map((x) => x.key)])].slice(-300),
    ),
  );
  const b = $("#bell .dot");
  if (b) b.remove();
}
document.addEventListener("click", () => {
  const p = $("#notifPanel");
  if (p) p.remove();
});

// Cek status pinjaman ke server tiap 20 detik; tampilkan pemberitahuan instan bila ada yang baru.
let _known = null;
setInterval(async () => {
  if (!me || document.hidden) return;
  try {
    await loadState();
    me = currentUser();
  } catch {
    return;
  }
  const list = notifications(),
    seen = readSet();
  const fresh = list.filter(
    (x) => !seen.has(x.key) && _known && !_known.has(x.key),
  );
  _known = new Set(list.map((x) => x.key));
  const bell = $("#bell");
  if (bell) bell.outerHTML = bellHTML();
  fresh.forEach((x) => toast(x));
  // Halaman Tanya Pustakawan diperbarui otomatis (kecuali sedang mengetik).
  if (
    location.hash === "#help" &&
    !$("#modal").innerHTML &&
    document.activeElement.tagName !== "TEXTAREA" &&
    document.activeElement.tagName !== "INPUT"
  )
    help();
}, 20000);
function toast(x) {
  const t = document.createElement("div");
  t.className = "toast notif " + x.cls;
  t.innerHTML = `<span>${x.icon}</span><p>${x.text}</p>`;
  t.onclick = () => t.remove();
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 8000);
}

// ===== Wishlist / Daftar Impian =====
// Daftar id buku yang disimpan anggota (disimpan di akun, ikut tersimpan ke MySQL).
const wl = () => (me && Array.isArray(me.wishlist) ? me.wishlist : []);
const inWl = (id) => wl().includes(id);
// Tombol hati di pojok sampul buku.
const heartBtn = (id) =>
  `<button class="heart ${inWl(id) ? "on" : ""}" title="${inWl(id) ? "Hapus dari Daftar Impian" : "Simpan ke Daftar Impian"}" onclick="event.stopPropagation();toggleWish(${id})">${inWl(id) ? "❤️" : "🤍"}</button>`;

// Tambah/hapus buku dari Daftar Impian lalu simpan ke server.
async function toggleWish(id) {
  const had = inWl(id);
  me.wishlist = had ? wl().filter((x) => x !== id) : [...wl(), id];
  const err = await save();
  flash = err
    ? "!" + err
    : had
      ? "Buku dihapus dari Daftar Impian"
      : "❤️ Buku disimpan ke Daftar Impian";
  render();
  closeModal();
}

// Halaman Daftar Impian: lihat buku tersimpan, pinjam langsung, atau pinjam beberapa sekaligus.
function wishlist() {
  const list = wl()
    .map((id) => db.books.find((b) => b.id === id))
    .filter(Boolean);
  const active = new Set(
    db.loans
      .filter(
        (l) =>
          l.userId === me.id &&
          ["Menunggu", "Siap Diambil", "Dipinjam"].includes(l.status),
      )
      .map((l) => l.bookId),
  );
  const can = (b) => b.stock > 0 && !active.has(b.id);
  app.innerHTML =
    userNav("wishlist") +
    `<div class="wrap">${flashHTML()}
   <div class="banner grad"><div><h2>❤️ Daftar Impian</h2><p>Buku favorit yang ingin kamu baca nanti</p></div>${list.some(can) ? `<button class="btn out" onclick="borrowWishlist()">📥 Pinjam Semua yang Tersedia</button>` : ""}</div>
   <h3 style="margin-bottom:12px">Buku Tersimpan <span class="tag">${list.length} buku</span></h3>
   ${
     list.length
       ? `<div class="books">${list
           .map(
             (
               b,
             ) => `<div class="book"><div class="cv" ${cover(b)}>${b.img ? "" : esc(b.title)}${heartBtn(b.id)}</div><div class="in">
     <span class="tag">${esc(b.cat)}</span><h4>${esc(b.title)}</h4>${ratingBadge(b.id)}<small>${esc(b.author)} · ${active.has(b.id) ? "Sudah diajukan/dipinjam" : b.stock > 0 ? "Stok " + b.stock : "Stok habis"}</small>
     <div class="acts"><button class="btn sm out" onclick="detail(${b.id})">👁 Detail</button><button class="btn sm" ${can(b) ? "" : "disabled"} onclick="quickBorrow(${b.id})">📥 Pinjam</button></div></div></div>`,
           )
           .join("")}</div>`
       : `<div class="card" style="text-align:center;padding:40px"><p style="font-size:40px">🤍</p><h3>Daftar Impian masih kosong</h3><p style="color:var(--mu)">Tekan ikon hati pada kartu buku di katalog untuk menyimpannya di sini.</p><br><button class="btn" onclick="go('catalog')">Jelajahi Katalog</button></div>`
   }</div>`;
}

// Pinjam semua buku tersedia di Daftar Impian sekaligus (server tetap cek batas pinjaman).
function borrowWishlist() {
  const active = new Set(
    db.loans
      .filter(
        (l) =>
          l.userId === me.id &&
          ["Menunggu", "Siap Diambil", "Dipinjam"].includes(l.status),
      )
      .map((l) => l.bookId),
  );
  const list = wl()
    .map((id) => db.books.find((b) => b.id === id))
    .filter((b) => b && b.stock > 0 && !active.has(b.id));
  $("#modal").innerHTML =
    `<div class="modal" onclick="if(event.target===this)closeModal()"><div class="card">
   <h3>📥 Pinjam dari Daftar Impian</h3><p class="txt">Pilih buku yang ingin diajukan:</p><br>
   ${list.map((b) => `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" class="wb" value="${b.id}" checked style="width:auto"> <span><b>${esc(b.title)}</b> — ${esc(b.author)}</span></label>`).join("")}<br>
   <label>Lama pinjam (hari)</label><input id="days" type="number" min="1" max="14" value="7">
   <small style="color:var(--mu)">ⓘ Setelah disetujui admin, buku wajib diambil dalam ${db.pickupDays} hari.</small><br><br>
   <button class="btn" onclick="submitWishBorrow()">📥 Ajukan Peminjaman</button> <button class="btn out" onclick="closeModal()">Batal</button></div></div>`;
}

async function submitWishBorrow() {
  if (!me.nim || !me.phone || !me.address) {
    closeModal();
    flash = "!Lengkapi NIM, telepon dan alamat di profil sebelum meminjam buku";
    return go("profile");
  }
  const ids = [...document.querySelectorAll(".wb:checked")].map(
    (x) => +x.value,
  );
  if (!ids.length) return closeModal();
  const days = Math.min(14, Math.max(1, +$("#days").value || 7));
  ids.forEach((id, i) =>
    db.loans.push({
      id: Date.now() + i,
      userId: me.id,
      bookId: id,
      days,
      date: today(),
      due: today(days),
      status: "Menunggu",
    }),
  );
  const err = await save();
  closeModal();
  flash = err
    ? "!" + err
    : `${ids.length} pengajuan peminjaman terkirim. Tunggu persetujuan admin.`;
  go("borrowing");
}

// Rekomendasi buku terkait: skor +3 penulis sama, +2 kategori sama, urut dari skor tertinggi.
function related(b) {
  const score = (x) =>
    (x.cat === b.cat ? 2 : 0) + (x.author === b.author ? 3 : 0);
  return db.books
    .filter((x) => x.id !== b.id && score(x) > 0)
    .sort((x, y) => score(y) - score(x))
    .slice(0, 4);
}

// ===== Ulasan & Rating (anggota) =====
// Ulasan milik anggota yang login untuk buku tertentu.
const myReview = (id) =>
  (db.reviews || []).find((r) => r.bookId === id && r.userId === me.id);
// Boleh mengulas jika buku sedang/pernah dipinjam (status Dipinjam atau Dikembalikan).
const canReview = (id) =>
  db.loans.some(
    (l) =>
      l.userId === me.id &&
      l.bookId === id &&
      ["Dipinjam", "Dikembalikan"].includes(l.status),
  );

// Form ulasan: pilih 1–5 bintang + tulis ulasan. Jika sudah pernah mengulas, form terisi ulasan lama.
function reviewFormHTML(b) {
  if (!canReview(b.id))
    return `<p class="txt rv-note">ⓘ Kamu bisa memberi rating & ulasan setelah meminjam buku ini.</p>`;
  const mine = myReview(b.id);
  window._rv = mine ? mine.rating : 0;
  return `<div class="rv-form" id="revForm"><h4>${mine ? "✏️ Ubah Ulasanmu" : "✍️ Tulis Ulasanmu"}</h4>
   <div class="star-pick" id="sp">${[1, 2, 3, 4, 5].map((v) => `<button type="button" data-v="${v}" class="${v <= window._rv ? "on" : ""}" onclick="pickStar(${v})" aria-label="${v} bintang">★</button>`).join("")}<span id="spl">${RATING_LABEL[window._rv] || "Pilih bintang"}</span></div>
   <textarea id="revText" rows="3" maxlength="1000" placeholder="Bagikan pendapatmu tentang buku ini (opsional)">${esc(mine ? mine.text : "")}</textarea>
   <div id="revErr" class="rv-err"></div>
   <button class="btn sm" onclick="submitReview(${b.id})">${mine ? "💾 Perbarui Ulasan" : "⭐ Kirim Ulasan"}</button></div>`;
}

// Klik bintang: simpan pilihan dan warnai bintang 1..v.
function pickStar(v) {
  window._rv = v;
  document
    .querySelectorAll("#sp button")
    .forEach((x) => x.classList.toggle("on", +x.dataset.v <= v));
  $("#spl").textContent = RATING_LABEL[v];
}

// Kirim ulasan ke server, lalu tampilkan ulang detail buku dengan rating terbaru.
async function submitReview(bookId) {
  if (!window._rv)
    return ($("#revErr").textContent =
      "Pilih rating 1 sampai 5 bintang terlebih dahulu.");
  try {
    db = await api("/api/review", {
      bookId,
      rating: window._rv,
      text: $("#revText").value,
    });
    me = currentUser();
  } catch (e) {
    return ($("#revErr").textContent = e.message);
  }
  onReviewChange(bookId, "⭐ Terima kasih! Ulasanmu sudah tersimpan.");
}

// Dipanggil setelah ulasan dikirim/dihapus: perbarui halaman, buka lagi detail buku dengan pesan.
function onReviewChange(bookId, msg) {
  render();
  detail(bookId, msg);
}

// Buka detail buku langsung di bagian form ulasan (dari tabel peminjaman / notifikasi).
function openReview(bookId) {
  const p = $("#notifPanel");
  if (p) p.remove();
  detail(bookId);
  const f = document.getElementById("revForm");
  if (f) f.scrollIntoView({ behavior: "smooth", block: "center" });
}

// Pop-up detail buku: info, abstrak, sinopsis, ulasan, rekomendasi, dan tombol pinjam.
function detail(id, msg) {
  const b = db.books.find((x) => x.id === id);
  if (!b) return;
  const rel = related(b);
  $("#modal").innerHTML =
    `<div class="modal" onclick="if(event.target===this)closeModal()"><div class="card">
   <div class="book"><div class="cv" ${cover(b)}>${b.img ? "" : esc(b.title)}</div></div><br>
   ${msg ? `<div class="alert ${msg.startsWith("!") ? "err" : ""}">${esc(msg.replace(/^!/, ""))}</div>` : ""}
   <h3>${esc(b.title)}</h3>${ratingBadge(b.id)}<p>Penulis: ${esc(b.author)}<br>Penerbit: ${esc(b.publisher)}<br>Tahun: ${b.year}<br>ISBN: ${esc(b.isbn)}<br>Kategori: ${esc(b.cat)}<br>Stok: ${b.stock}</p><br>
   <h4>📝 Abstrak</h4><p class="txt">${esc(b.abstract) || "<i>Belum ada abstrak.</i>"}</p><br>
   <h4>📖 Sinopsis</h4><p class="txt">${esc(b.synopsis) || "<i>Belum ada sinopsis.</i>"}</p><br>
   <h4>⭐ Ulasan & Rating Pembaca</h4>${reviewFormHTML(b)}${reviewsHTML(b.id, true)}<br>
   <h4>📚 Rekomendasi Buku Terkait</h4>
   ${rel.length ? `<div class="rel">${rel.map((x) => `<a class="relb" onclick="detail(${x.id})"><div class="cv" ${cover(x)}>${x.img ? "" : esc(x.title)}</div><small><b>${esc(x.title)}</b><br>${esc(x.author)}</small>${ratingBadge(x.id)}</a>`).join("")}</div>` : `<p class="txt"><i>Belum ada buku terkait.</i></p>`}<br>
   <label>Lama pinjam (hari)</label><input id="days" type="number" min="1" max="14" value="7">
   <small style="color:var(--mu)">ⓘ Setelah disetujui admin, buku wajib diambil dalam ${db.pickupDays} hari. Jika tidak, booking otomatis kedaluwarsa.</small><br><br>
   <button class="btn" ${b.stock < 1 ? "disabled" : ""} onclick="borrow(${b.id})">📥 Pinjam Buku</button> <button class="btn out" onclick="toggleWish(${b.id})">${inWl(b.id) ? "💔 Hapus dari Impian" : "❤️ Simpan"}</button> <button class="btn out" onclick="askLibrarian('buku', ${b.id})">💬 Tanya Pustakawan</button> <button class="btn out" onclick="closeModal()">Tutup</button></div></div>`;
}

// Pop-up pinjam cepat dari kartu katalog: pilih lama pinjam lalu ajukan.
function quickBorrow(id) {
  const b = db.books.find((x) => x.id === id);
  if (!b) return;
  $("#modal").innerHTML =
    `<div class="modal" onclick="if(event.target===this)closeModal()"><div class="card">
   <h3>📥 Pinjam Buku</h3><p class="txt"><b>${esc(b.title)}</b> — ${esc(b.author)}<br>Stok tersedia: ${b.stock}</p><br>
   <label>Lama pinjam (hari)</label><input id="days" type="number" min="1" max="14" value="7">
   <small style="color:var(--mu)">ⓘ Setelah disetujui admin, buku wajib diambil dalam ${db.pickupDays} hari.</small><br><br>
   <button class="btn" onclick="borrow(${b.id})">📥 Ajukan Peminjaman</button> <button class="btn out" onclick="closeModal()">Batal</button></div></div>`;
}

// Ajukan peminjaman: wajib lengkapi profil dulu, lama pinjam 1–14 hari, status awal "Menunggu".
async function borrow(id) {
  if (!me.nim || !me.phone || !me.address) {
    closeModal();
    flash = "!Lengkapi NIM, telepon dan alamat di profil sebelum meminjam buku";
    return go("profile");
  }
  const days = Math.min(14, Math.max(1, +$("#days").value || 7));
  db.loans.push({
    id: Date.now(),
    userId: me.id,
    bookId: id,
    days,
    date: today(),
    due: today(days),
    status: "Menunggu",
  });
  const err = await save();
  closeModal();
  flash = err
    ? "!" + err
    : "Pengajuan peminjaman terkirim. Tunggu persetujuan admin.";
  go("borrowing");
}

// Label status peminjaman (merah "Terlambat X hari" jika lewat batas).
function statusTag(l) {
  const late = lateDays(l);
  return late
    ? `<span class="tag bad">Terlambat ${late} hari</span>`
    : `<span class="tag ${STATUS_CLS[l.status] ?? ""}">${l.status}</span>`;
}

// Isi kolom tanggal: batas ambil jika "Siap Diambil", tanggal kembali jika dipinjam.
const dueCell = (l) =>
  l.status === "Siap Diambil"
    ? `<small>Ambil sebelum</small><br><b>${l.pickupBy}</b>`
    : l.status === "Menunggu" ||
        l.status === "Ditolak" ||
        l.status === "Booking Kedaluwarsa"
      ? "-"
      : l.due;

// Kolom ulasan: tombol "Beri Ulasan" untuk buku yang sedang/selesai dipinjam, atau bintang ulasan yang sudah diberikan.
function reviewCell(l) {
  if (!["Dipinjam", "Dikembalikan"].includes(l.status)) return "-";
  const r = myReview(l.bookId);
  return r
    ? `${starsHTML(r.rating)}<br><a onclick="openReview(${l.bookId})"><small>✏️ Ubah</small></a>`
    : `<button class="btn sm" onclick="openReview(${l.bookId})">⭐ Beri Ulasan</button>`;
}

// Halaman "Peminjaman Saya": ringkasan, filter status, dan tabel riwayat pinjaman.
function borrowing() {
  const st = window._st || "";
  const mine = db.loans.filter((l) => l.userId === me.id);
  const list = mine.filter((l) => !st || l.status === st);
  app.innerHTML =
    userNav("borrowing") +
    `<div class="wrap">${flashHTML()}
   <div class="banner grad"><div><h2>📚 Peminjaman Saya</h2><p>Lihat dan kelola peminjaman buku Anda</p></div><button class="btn out" onclick="go('catalog')">+ Pinjam Buku</button></div>
   <div class="cards" style="margin:0 0 18px"><div class="card stat"><b>${mine.filter((l) => l.status === "Dipinjam").length}</b><span>Peminjaman Aktif</span></div>
    <div class="card stat"><b>${mine.filter(lateDays).length}</b><span>Terlambat</span></div>
    <div class="card stat"><b>${rp(mine.reduce((s, l) => s + fine(l), 0))}</b><span>Total Denda</span><a class="stat-link" onclick="askLibrarian('denda')">💬 Ada kendala denda? Tanya Pustakawan</a></div></div>
   <div class="row"><select id="st"><option value="">Semua Status</option>${["Menunggu", "Siap Diambil", "Dipinjam", "Dikembalikan", "Ditolak", "Booking Kedaluwarsa"].map((x) => `<option ${x === st ? "selected" : ""}>${x}</option>`).join("")}</select></div>
   <table><tr><th>Buku</th><th>Tanggal Pinjam</th><th>Tanggal Kembali / Batas Ambil</th><th>Status</th><th>Denda</th><th>Ulasan</th></tr>
   ${
     list
       .map((l) => {
         const b = db.books.find((x) => x.id === l.bookId) || {};
         return `<tr><td><b>${esc(b.title)}</b><br><small>${esc(b.author)}</small></td><td>${l.date}</td><td>${dueCell(l)}</td><td>${statusTag(l)}</td><td>${fine(l) ? rp(fine(l)) : "-"}</td><td>${reviewCell(l)}</td></tr>`;
       })
       .join("") || `<tr><td colspan="6">Belum ada peminjaman.</td></tr>`
   }</table></div>`;
  // Filter tabel berdasarkan status yang dipilih.
  $("#st").onchange = (e) => {
    window._st = e.target.value;
    borrowing();
  };
}

// ===== Tanya Pustakawan / Pusat Bantuan =====
const unreadThreads = () =>
  (db.threads || []).filter((t) => t.unreadUser).length;

// Pertanyaan umum (FAQ) — diambil dari aturan perpustakaan yang berlaku.
const FAQ = () => [
  [
    "Berapa denda keterlambatan?",
    `Denda ${rp(DENDA_PER_HARI)} per hari untuk setiap buku yang terlambat dikembalikan. Denda dibayar saat buku dikembalikan ke petugas.`,
  ],
  [
    "Berapa buku yang bisa saya pinjam?",
    "Maksimal 3 pinjaman aktif sekaligus, dengan lama pinjam 1–14 hari per buku.",
  ],
  [
    "Kapan buku harus diambil?",
    `Setelah peminjaman disetujui admin, buku wajib diambil dalam ${db.pickupDays} hari. Jika tidak, booking otomatis kedaluwarsa.`,
  ],
  [
    "Kenapa saya tidak bisa meminjam?",
    "Pastikan NIM, telepon, dan alamat di profil sudah diisi, stok buku tersedia, dan tidak ada buku yang terlambat dikembalikan.",
  ],
  [
    "Bagaimana cara mengusulkan buku baru?",
    "Kirim pesan dengan topik “Usul Buku Baru”, tulis judul, penulis, dan alasan kamu mengusulkannya.",
  ],
];

// Placeholder isi pesan sesuai topik.
const HINT = {
  usul: "Tulis judul buku, penulis, penerbit (jika tahu), dan alasan mengusulkan buku ini...",
  denda:
    "Ceritakan kendala dendamu, misalnya buku mana dan tanggal berapa dikembalikan...",
  buku: "Tulis pertanyaanmu seputar buku, misalnya ketersediaan, edisi, atau isi buku...",
  lain: "Tulis pertanyaan atau pesanmu untuk pustakawan...",
};

// Buka halaman bantuan dengan topik (dan buku) yang sudah terpilih.
function askLibrarian(topic, bookId) {
  closeModal();
  window._th = null;
  window._newTopic = topic;
  window._newBook = bookId || "";
  if (location.hash === "#help") help();
  else go("help");
}

// Buka satu percakapan (dari daftar riwayat atau notifikasi).
function openThread(id) {
  const p = $("#notifPanel");
  if (p) p.remove();
  window._th = id;
  if (location.hash === "#help") help();
  else go("help");
}

// Halaman "Tanya Pustakawan": form pesan baru + FAQ + riwayat percakapan, atau tampilan satu percakapan.
function help() {
  const th = window._th && (db.threads || []).find((t) => t.id === window._th);
  if (th) return threadView(th);
  window._th = null;
  const topic = window._newTopic || "usul",
    list = sortThreads(db.threads || []);
  const f = window._hf || "";
  const shown = list.filter((t) => !f || t.status === f);
  app.innerHTML =
    userNav("help") +
    `<div class="wrap">${flashHTML()}
   <div class="banner grad"><div><h2>💬 Tanya Pustakawan</h2><p>Pusat bantuan resmi: usul buku baru, kendala denda, atau pertanyaan seputar buku</p></div></div>
   <div class="grid2 help-grid">
    <div class="card"><h3>✉️ Kirim Pesan Baru</h3><p class="txt">Pustakawan akan membalas di halaman ini. Kamu juga mendapat notifikasi 🔔 saat ada balasan.</p><br>
     <form id="mf"><label>Topik *</label><div class="topics">${Object.entries(
       TOPIK,
     )
       .map(
         ([k, v]) =>
           `<label class="topic ${k === topic ? "on" : ""}"><input type="radio" name="topic" value="${k}" ${k === topic ? "checked" : ""}>${v}</label>`,
       )
       .join("")}</div>
      <div id="bookPick" class="${topic === "buku" ? "" : "hidden"}"><label>Buku terkait (opsional)</label><select name="bookId"><option value="">— Pilih buku —</option>${db.books.map((b) => `<option value="${b.id}" ${+window._newBook === b.id ? "selected" : ""}>${esc(b.title)} — ${esc(b.author)}</option>`).join("")}</select></div>
      <label>Judul Pesan *</label><input name="subject" maxlength="120" required placeholder="Contoh: Usul buku Filosofi Teras">
      <label>Isi Pesan *</label><textarea name="text" rows="5" maxlength="2000" required placeholder="${HINT[topic]}"></textarea>
      <button class="btn">📨 Kirim ke Pustakawan</button></form></div>
    <div class="card" style="align-self:start"><h3>❓ Pertanyaan Umum</h3><br>${FAQ()
      .map(
        ([q, a]) =>
          `<details class="faq"><summary>${q}</summary><p>${a}</p></details>`,
      )
      .join("")}</div>
   </div>
   <div class="card" style="margin-top:18px"><div class="th-head"><h3>🗂 Riwayat Percakapan <span class="tag">${list.length}</span></h3>
    <select id="hf" style="max-width:220px;margin:0"><option value="">Semua Status</option>${["Menunggu Balasan", "Dibalas", "Selesai"].map((x) => `<option ${x === f ? "selected" : ""}>${x}</option>`).join("")}</select></div>
    ${shown.length ? `<div class="th-list">${shown.map((t) => threadRow(t, t.unreadUser)).join("")}</div>` : `<p class="txt" style="padding:18px 0;text-align:center">${list.length ? "Tidak ada percakapan dengan status ini." : "Belum ada percakapan. Kirim pesan pertamamu di atas!"}</p>`}</div></div>`;
  // Ganti topik: tampilkan pilihan buku & ubah contoh isi pesan.
  document.querySelectorAll("#mf input[name=topic]").forEach(
    (r) =>
      (r.onchange = () => {
        window._newTopic = r.value;
        document
          .querySelectorAll(".topic")
          .forEach((x) => x.classList.toggle("on", x.contains(r)));
        $("#bookPick").classList.toggle("hidden", r.value !== "buku");
        $("#mf textarea").placeholder = HINT[r.value];
      }),
  );
  $("#hf").onchange = (e) => {
    window._hf = e.target.value;
    help();
  };
  // Kirim pesan baru ke server.
  $("#mf").onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (d.topic !== "buku") d.bookId = "";
    try {
      db = await api("/api/msg/new", d);
      me = currentUser();
      window._newTopic = window._newBook = null;
      flash = "📨 Pesan terkirim! Pustakawan akan segera membalas.";
    } catch (err) {
      flash = "!" + err.message;
    }
    help();
  };
}

// Satu baris di daftar riwayat percakapan.
function threadRow(t, unread, extra = "") {
  const ms = msgsOf(t.id),
    last = ms[ms.length - 1];
  return `<a class="th-row ${unread ? "unread" : ""} ${window._th === t.id ? "on" : ""}" onclick="openThread(${t.id})">
   <div class="th-main"><div><span class="tag">${TOPIK[t.topic] || t.topic}</span> <span class="tag ${THREAD_CLS[t.status] ?? ""}">${t.status}</span>${unread ? ` <span class="tag bad">Baru</span>` : ""}</div>
   <b>${esc(t.subject)}</b>${extra}<small>${last ? (last.sender === "admin" ? "Pustakawan: " : "Kamu: ") + esc(last.text.slice(0, 90)) + (last.text.length > 90 ? "…" : "") : ""}</small></div>
   <small class="th-time">${fmtTime(t.updated)}<br>${ms.length} pesan</small></a>`;
}

// Tampilan satu percakapan: gelembung chat + kotak balasan.
async function threadView(t) {
  app.innerHTML =
    userNav("help") +
    `<div class="wrap">${flashHTML()}
   <div class="row" style="align-items:center"><button class="btn out sm" style="flex:none" onclick="window._th=null;help()">← Kembali</button></div>
   <div class="card thread"><div class="th-top"><div><span class="tag">${TOPIK[t.topic] || t.topic}</span> <span class="tag ${THREAD_CLS[t.status] ?? ""}">${t.status}</span><h3>${esc(t.subject)}</h3><small class="txt">Dibuat ${fmtTime(t.created)}</small></div>
    ${t.status !== "Selesai" ? `<button class="btn sm green" onclick="closeThread(${t.id})">✔ Tandai Selesai</button>` : ""}</div>
    ${chatHTML(t, "user")}
    <div class="reply"><textarea id="rt" rows="3" maxlength="2000" placeholder="${t.status === "Selesai" ? "Percakapan sudah selesai. Kirim balasan untuk membukanya lagi..." : "Tulis balasan..."}" oninput="draftInput('u${t.id}', this)">${esc(drafts["u" + t.id] || "")}</textarea>
     <button class="btn" onclick="replyThread(${t.id})">📨 Kirim</button></div></div></div>`;
  scrollChat();
  // Tandai balasan pustakawan sudah dibaca.
  if (t.unreadUser) {
    try {
      db = await api("/api/msg/update", { threadId: t.id, read: true });
      me = currentUser();
      const b = $("#bell");
      if (b) b.outerHTML = bellHTML();
      document.querySelectorAll(".pill").forEach((x) => x.remove());
    } catch {}
  }
}

async function replyThread(id) {
  const text = $("#rt").value.trim();
  if (!text) return $("#rt").focus();
  try {
    db = await api("/api/msg/reply", { threadId: id, text });
    me = currentUser();
    delete drafts["u" + id];
  } catch (err) {
    flash = "!" + err.message;
  }
  help();
}

async function closeThread(id) {
  try {
    db = await api("/api/msg/update", { threadId: id, status: "Selesai" });
    me = currentUser();
    flash = "Percakapan ditandai selesai. Terima kasih!";
  } catch (err) {
    flash = "!" + err.message;
  }
  help();
}

// ==========================================
// HALAMAN PROFIL & KARTU DIGITAL
// ==========================================
function profile() {
  // Hitung statistik membaca anggota saat ini
  const totalDibaca = db.loans.filter(
    (l) => l.userId === me.id && l.status === "Dikembalikan",
  ).length;
  const pinjamAktif = db.loans.filter(
    (l) =>
      l.userId === me.id &&
      ["Dipinjam", "Menunggu", "Siap Diambil"].includes(l.status),
  ).length;
  const impian = (me.wishlist || []).length;
  const ulasanDibuat = db.reviews.filter((r) => r.userId === me.id).length;

  // Kode ID kartu dari nomor urut anggota yang dihitung server (me.memberNo).
  // Contoh: anggota ke-2 -> LIBI-000002. Kartu hanya untuk anggota (admin dialihkan ke portal admin).
  const memberCode = `LIBI-${String(me.memberNo || 1).padStart(6, "0")}`;

  // Pangkat penjelajah berdasarkan jumlah buku yang sudah selesai dibaca.
  // Semakin banyak membaca, semakin tinggi pangkat & warna kartunya.
  const TIERS = [
    { min: 0, name: "Bintang Baru", icon: "🌱", cls: "t1" },
    { min: 3, name: "Penjelajah Bintang", icon: "✨", cls: "t2" },
    { min: 10, name: "Navigator Galaksi", icon: "🪐", cls: "t3" },
    { min: 25, name: "Legenda Semesta", icon: "🌌", cls: "t4" },
  ];
  const tier = [...TIERS].reverse().find((t) => totalDibaca >= t.min);
  const nextTier = TIERS.find((t) => t.min > totalDibaca);
  // Persentase progres menuju pangkat berikutnya (100% jika sudah pangkat tertinggi)
  const progres = nextTier
    ? Math.round(((totalDibaca - tier.min) / (nextTier.min - tier.min)) * 100)
    : 100;

  // Kode QR asli (bisa dipindai) dibuat lewat library QRCode yang sudah dimuat di user.html.
  // Dibuat di elemen sementara (tidak perlu ditempel ke DOM) lalu diambil sebagai gambar data-URI.
  const renderQR = (text) => {
    // Library QR gagal dimuat (misal tanpa internet): tampilkan kode teks sebagai cadangan.
    const fallback = `<div class="libi-qr-fallback" title="Kode QR tidak dapat dimuat">${esc(text)}</div>`;
    if (typeof QRCode === "undefined") return fallback;
    try {
      const holder = document.createElement("div");
      new QRCode(holder, {
        text,
        width: 120,
        height: 120,
        colorDark: "#0f0c29",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });
      const canvas = holder.querySelector("canvas");
      const src = canvas ? canvas.toDataURL("image/png") : "";
      return src
        ? `<img class="libi-qr-img" src="${src}" alt="Kode QR anggota ${esc(text)}" width="120" height="120">`
        : fallback;
    } catch (e) {
      return fallback;
    }
  };

  app.innerHTML =
    userNav("profile") +
    `<div class="wrap">${flashHTML()}` +
    // 1. KARTU ANGGOTA DIGITAL KOSMIK (LIBIVERSE EXPLORER CARD)
    //    Kelas tier (t1-t4) mengubah warna kartu sesuai pangkat anggota.
    `<div class="libi-card-wrapper">
      <div class="libi-member-card ${tier.cls}">
        <div class="libi-card-shine"></div>
        <div class="libi-card-brand">
          <span class="libi-card-logo">📚 LIBIVERSE</span>
          <span class="libi-card-badge">${tier.icon} ${esc(tier.name)}</span>
        </div>` +
    // AREA TENGAH: chip EMV | identitas (ID, nama, email)
    `<div class="libi-card-main">
          <div class="libi-card-chip" aria-hidden="true"></div>
          <div class="libi-card-main-info">
            <div class="libi-card-number">${esc(memberCode)}</div>
            <div class="libi-card-name">${esc((me.name || "").toUpperCase())}</div>
            <div class="libi-card-email">${esc(me.email || "")}</div>
          </div>
        </div>` +
    // FOOTER KARTU: NIM & tanggal bergabung | kode QR untuk scanner
    `<div class="libi-card-bottom">
          <div class="libi-card-metas">
            <div class="libi-card-meta"><small>NIM</small><b>${esc(me.nim || "-")}</b></div>
            <div class="libi-card-meta"><small>BERGABUNG</small><b>${esc(me.created || "-")}</b></div>
          </div>
          <div class="libi-card-qr">${renderQR(memberCode)}</div>
        </div>
      </div>
    </div>` +
    // PROGRES PANGKAT: berapa buku lagi untuk naik ke pangkat berikutnya
    `<div class="libi-tier-progress">
      <div class="libi-tier-text">
        ${
          nextTier
            ? `Baca <b>${nextTier.min - totalDibaca}</b> buku lagi untuk menjadi <b>${nextTier.icon} ${esc(nextTier.name)}</b>`
            : `🏆 Kamu sudah mencapai pangkat tertinggi!`
        }
      </div>
      <div class="libi-tier-bar"><span style="width:${progres}%"></span></div>
    </div>` +
    // 2. STATISTIK JEJAK MEMBACA ANGGOTA
    `<div class="libi-stats-grid">
      <div class="libi-stat-box"><span class="libi-stat-icon">📖</span><div class="libi-stat-num">${totalDibaca}</div><div class="libi-stat-lbl">Buku Selesai Dibaca</div></div>
      <div class="libi-stat-box"><span class="libi-stat-icon">🔄</span><div class="libi-stat-num">${pinjamAktif}</div><div class="libi-stat-lbl">Pinjaman Aktif</div></div>
      <div class="libi-stat-box"><span class="libi-stat-icon">❤️</span><div class="libi-stat-num">${impian}</div><div class="libi-stat-lbl">Daftar Impian</div></div>
      <div class="libi-stat-box"><span class="libi-stat-icon">⭐</span><div class="libi-stat-num">${ulasanDibuat}</div><div class="libi-stat-lbl">Ulasan Ditulis</div></div>
    </div>` +
    // 3. FORM EDIT DATA DIRI
    `<div class="grid2">
      <div class="card">
        <h3>👤 Edit Data Pribadi</h3><br>
        <form id="f">

          <label>Nama Lengkap</label>
          <input name="name" value="${esc(me.name)}" required>

          <label>Email</label>
          <input name="email" type="email" value="${esc(me.email)}" required>

          <label>NIM *</label>
          <input name="nim" pattern="[A-Za-z0-9]{5,20}" value="${esc(me.nim)}">
          <small style="color:var(--mu)">ⓘ Digunakan untuk verifikasi peminjaman</small><br><br>

          <label>Nomor Telepon / WhatsApp *</label>
          <input name="phone" type="tel" inputmode="tel" value="${esc(me.phone || "")}" placeholder="Contoh: 081234567890">

          <label>Alamat Lengkap *</label>
          <textarea name="address" placeholder="Alamat domisili lengkap">${esc(me.address || "")}</textarea>
          
          <label>Password Lama (wajib diisi jika ganti password)</label>
          <div class="pwd-wrap">
            <input name="current" type="password" autocomplete="current-password" placeholder="Password saat ini">
            <button type="button" class="pwd-toggle" aria-label="Lihat password" title="Lihat password" onclick="togglePwd(this)">${EYE_ICON}</button>
          </div>

          <label>Password Baru (opsional)</label>
          <div class="pwd-wrap">
            <input name="password" type="password" minlength="8" autocomplete="new-password" placeholder="Minimal 8 karakter">
            <button type="button" class="pwd-toggle" aria-label="Lihat password" title="Lihat password" onclick="togglePwd(this)">${EYE_ICON}</button>
          </div>

          <button class="btn">Simpan Perubahan</button>
        </form>
      </div>

      <div class="card" style="align-self:start">
        <h3 style="color:var(--bad)">🗑 Hapus Akun</h3>
        <p style="color:var(--mu);font-size:13px">Tindakan ini tidak dapat dibatalkan. Riwayat akun Anda akan dihapus dari perpustakaan.</p><br>
        <button class="btn red" onclick="delMe()">Hapus Akun</button>
      </div>
    </div>

    </div>`;

  // Simpan perubahan data diri ke server
  $("#f").onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    // Cek kolom yang diubah saja; data lama yang belum rapi tidak menghalangi simpan.
    const changed = ["email", "nim", "phone"].filter((k) => String(f[k] || "").trim() !== String(me[k] || ""));
    const bad = cekKontak(f, changed);
    if (bad) return fieldError(e.target, ...bad);
    if (f.password) {
      try {
        await api("/api/password", {
          current: f.current,
          password: f.password,
        });
      } catch (err) {
        flash = "!" + err.message;
        return profile();
      }
    }
    ["name", "email", "nim", "phone", "address"].forEach(
      (k) => (me[k] = String(f[k] || "").trim()),
    );
    if (/^08\d{8,11}$/.test(normPhone(me.phone))) me.phone = normPhone(me.phone); // simpan bentuk baku 08xxx
    const err = await save();
    flash = err ? "!" + err : "Profil berhasil diperbarui";
    profile();
  };
}

// Hapus akun sendiri (admin tidak boleh), lalu kembali ke beranda.
async function delMe() {
  if (me.role === "admin") {
    flash = "!Akun admin tidak bisa dihapus";
    return profile();
  }
  if (!confirm("Yakin hapus akun?")) return;
  try {
    await api("/api/delete-me", {});
    go("home");
  } catch (err) {
    flash = "!" + err.message;
    profile();
  }
}

// Wajib login sebagai anggota, lalu tampilkan halaman sesuai hash (#catalog/#borrowing/#profile).
function render() {
  if (!requireLogin("user")) return;
  // Area ini khusus anggota; akun admin tidak punya kartu anggota, jadi dialihkan ke portal admin.
  if (me.role === "admin") {
    location.href = "admin.html";
    return;
  }
  const r = location.hash.slice(1) || "catalog";
  (({ catalog, wishlist, borrowing, help, profile })[r] || catalog)();
  if (!_known) {
    _known = new Set(notifications().map((x) => x.key));
    const seen = readSet();
    notifications()
      .filter((x) => !seen.has(x.key))
      .slice(0, 3)
      .forEach(toast);
  }
  // Lanjutkan "Request Peminjaman" dari beranda: buka detail buku yang dipilih sebelum login.
  const pend = +sessionStorage.getItem("libiverse_pending_book");
  if (pend) {
    sessionStorage.removeItem("libiverse_pending_book");
    if (r === "catalog") detail(pend);
  }
}

// Render ulang saat hash URL berubah.
window.addEventListener("hashchange", render);
boot();
