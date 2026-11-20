// ===== admin.js =====
// Panel admin: dashboard, buku, kategori, peminjaman, pengguna.
// Label status peminjaman (merah "Terlambat X hari" jika lewat batas).
function statusTag(l) {
  const late = lateDays(l);
  return late
    ? `<span class="tag bad">Terlambat ${late} hari</span>`
    : `<span class="tag ${STATUS_CLS[l.status] ?? ""}">${l.status}</span>`;
}

// Kerangka panel admin: sidebar menu + area konten, lalu panggil halaman sesuai menu.
function adminPage(r) {
  const sub = r.split("/")[1] || "dashboard";
  const L = (k, t) =>
    `<a class="${sub === k ? "on" : ""}" onclick="go('admin/${k}')">${t}</a>`;
  app.innerHTML = `<div class="admin"><aside class="side"><div class="logo" style="color:#fff;margin-bottom:20px">📚 Libiverse</div>
    ${L("dashboard", "🏠 Dashboard")}${L("books", "📘 Buku")}${L("categories", "🏷 Kategori")}${L("loans", "🔄 Peminjaman")}${L("users", "👥 Pengguna")}${L("reviews", "⭐ Ulasan" + (reviewTodo() ? ` <span class="pill">${reviewTodo()}</span>` : ""))}${L("inbox", "💬 Pesan Masuk" + (waiting() ? ` <span class="pill">${waiting()}</span>` : ""))}
    <a onclick="go('home')">🌐 Lihat Situs</a>
    <div class="who">👤 ${esc(me.name)}<br><small>Administrator</small></div><button class="btn red" onclick="logout()">⏻ Keluar</button></aside>
    <main class="main" id="main"></main></div>`;
  (
    ({
      dashboard: aDash,
      books: aBooks,
      categories: aCats,
      loans: aLoans,
      users: aUsers,
      reviews: aReviews,
      inbox: aInbox,
    })[sub] || aDash
  )();
}

// Dashboard: kartu statistik dan grafik batang peminjaman per bulan tahun ini.
function aDash() {
  const L = db.loans;
  $("#main").innerHTML =
    `${flashHTML()}<div class="banner grad"><div><h2>📊 Dashboard</h2><p>Selamat datang kembali, ${esc(me.name)}</p></div></div>
  <div class="cards" style="margin:0 0 20px">
   ${[
     ["📘", db.books.length, "Total Buku"],
     ["👥", db.users.length, "Total Pengguna"],
     [
       "🔄",
       L.filter((l) => l.status === "Dipinjam").length,
       "Peminjaman Aktif",
     ],
     ["⚠️", L.filter(lateDays).length, "Terlambat"],
     [
       "⏳",
       L.filter((l) => l.status === "Menunggu").length,
       "Permintaan Tertunda",
     ],
     ["💬", waiting(), "Pesan Belum Dibalas"],
     [
       "📦",
       L.filter((l) => l.status === "Siap Diambil").length,
       "Menunggu Diambil",
     ],
     [
       "⌛",
       L.filter((l) => l.status === "Booking Kedaluwarsa").length,
       "Booking Kedaluwarsa",
     ],
     ["🏷", db.categories.length, "Kategori"],
     ["💰", rp(L.reduce((s, l) => s + fine(l), 0)), "Total Denda"],
     ["✅", L.length, "Total Peminjaman"],
     [
       "⭐",
       (db.reviews || []).length
         ? (
             db.reviews.reduce((s, r) => s + r.rating, 0) / db.reviews.length
           ).toFixed(1) + " / 5"
         : "-",
       `Rata-rata Rating (${(db.reviews || []).length} ulasan)`,
     ],
   ]
     .map(
       ([i, v, t]) =>
         `<div class="card stat">${i}<b>${v}</b><span>${t}</span></div>`,
     )
     .join("")}</div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3>📈 Peminjaman Buku Bulanan (${new Date().getFullYear()})</h3>
      <span style="font-size:12px;color:var(--mu)">Total: ${L.filter((l) => new Date(l.date).getFullYear() === new Date().getFullYear()).length} transaksi</span>
    </div>
    <div style="position:relative;height:260px;width:100%">
      <canvas id="ch"></canvas>
    </div>
  </div>`;

  const y = new Date().getFullYear();
  const m = Array(12).fill(0);
  L.forEach((l) => {
    const d = new Date(l.date);
    if (d.getFullYear() === y) m[d.getMonth()]++;
  });
  const mon = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];

  if (window._loanChart) window._loanChart.destroy();

  const ctx = document.getElementById("ch").getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 240);
  grad.addColorStop(0, "rgba(91, 91, 214, 0.95)");
  grad.addColorStop(1, "rgba(124, 77, 204, 0.35)");

  window._loanChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: mon,
      datasets: [
        {
          label: "Peminjaman",
          data: m,
          backgroundColor: grad,
          borderRadius: 8,
          borderSkipped: false,
          maxBarThickness: 38,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1f2340",
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: (item) => ` ${item.parsed.y} buku dipinjam`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#6b7090", font: { family: "Segoe UI", size: 12 } },
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            precision: 0,
            color: "#6b7090",
            font: { family: "Segoe UI", size: 12 },
          },
          grid: {
            color: "#e3e5f0",
            borderDash: [4, 4],
          },
        },
      },
    },
  });
}

// Manajemen buku: tabel buku + pencarian judul/penulis/ISBN.
function aBooks() {
  const q = (window._bq || "").toLowerCase();
  const list = db.books.filter((b) =>
    (b.title + b.author + b.isbn).toLowerCase().includes(q),
  );
  $("#main").innerHTML =
    `${flashHTML()}<div class="banner grad"><div><h2>📘 Manajemen Buku</h2><p>Kelola koleksi buku Anda</p></div><button class="btn out" onclick="bookForm()">+ Tambah Buku Baru</button></div>
  <div class="row"><input id="bq" placeholder="Cari berdasarkan judul, penulis, atau ISBN" value="${esc(window._bq || "")}"></div>
  <table><tr><th>Sampul</th><th>Judul</th><th>Penulis</th><th>Kategori</th><th>Tahun</th><th>Stok</th><th>Rating</th><th>Aksi</th></tr>
  ${list
    .map(
      (
        b,
      ) => `<tr><td><div class="book" style="width:40px"><div class="cv" style="height:54px;font-size:8px;${b.img ? `background-image:url('${b.img}')` : `background:${colors[b.id % colors.length]}`}"></div></div></td>
   <td><b>${esc(b.title)}</b><br><small>${esc(b.isbn)}</small></td><td>${esc(b.author)}</td><td><span class="tag">${esc(b.cat)}</span></td><td>${b.year}</td><td><span class="tag ok">${b.stock} tersedia</span></td><td>${ratingBadge(b.id)}</td>
   <td><button class="btn sm" onclick="bookForm(${b.id})">✏️</button> <button class="btn sm red" onclick="delBook(${b.id})">🗑</button></td></tr>`,
    )
    .join("")}</table>`;
  // Pencarian langsung saat mengetik.
  $("#bq").oninput = (e) => {
    window._bq = e.target.value;
    aBooks();
    $("#bq").focus();
    $("#bq").setSelectionRange(999, 999);
  };
}

// Form tambah/edit buku (pop-up). Jika id kosong → buku baru dengan nilai default.
function bookForm(id) {
  const b = db.books.find((x) => x.id === id) || {
    title: "",
    author: "",
    publisher: "",
    year: new Date().getFullYear(),
    isbn: "978" + Math.floor(Math.random() * 1e10),
    cat: db.categories[0],
    stock: 1,
    img: "",
    abstract: "",
    synopsis: "",
  };
  $("#modal").innerHTML =
    `<div class="modal"><div class="card"><h3>${id ? "✏️ Edit Buku" : "+ Tambah Buku Baru"}</h3><br><form id="bf">
   <label>Judul *</label><input name="title" value="${esc(b.title)}" required>
   <label>Penulis *</label><input name="author" value="${esc(b.author)}" required>
   <label>Penerbit</label><input name="publisher" value="${esc(b.publisher)}">
   <div class="grid2"><div><label>Tahun *</label><input name="year" type="number" value="${b.year}" required></div>
   <div><label>Kategori *</label><select name="cat">${db.categories.map((c) => `<option ${c === b.cat ? "selected" : ""}>${c}</option>`).join("")}</select></div></div>
   <div class="grid2"><div><label>ISBN *</label><input name="isbn" value="${esc(b.isbn)}" required></div><div><label>Stok *</label><input name="stock" type="number" min="0" value="${b.stock}" required></div></div>
   <label>Abstrak</label><textarea name="abstract" rows="3" placeholder="Ringkasan singkat isi buku">${esc(b.abstract)}</textarea>
   <label>Sinopsis</label><textarea name="synopsis" rows="5" placeholder="Gambaran alur / isi buku">${esc(b.synopsis)}</textarea>
   <label>Gambar Sampul (Max 2MB)</label><input type="file" id="img" accept="image/*">
   <button class="btn">Simpan</button> <button type="button" class="btn out" onclick="closeModal()">Batal</button></form></div></div>`;
  // Simpan buku: ubah angka, baca gambar sampul (maks 2MB) jadi base64, lalu kirim ke server.
  $("#bf").onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    f.year = +f.year;
    f.stock = +f.stock;
    const file = $("#img").files[0];
    if (file) {
      if (file.size > 2e6) return alert("Maksimal 2MB");
      f.img = await new Promise((r) => {
        const fr = new FileReader();
        fr.onload = () => r(fr.result);
        fr.readAsDataURL(file);
      });
    }
    if (id) Object.assign(b, f);
    else db.books.push({ id: Date.now(), img: "", ...f });
    await save();
    closeModal();
    flash = id ? "Book updated successfully." : "Book created successfully.";
    aBooks();
  };
}

// Hapus buku, ditolak jika buku masih dipinjam/diajukan/menunggu diambil.
async function delBook(id) {
  if (
    db.loans.some(
      (l) =>
        l.bookId === id &&
        ["Dipinjam", "Menunggu", "Siap Diambil"].includes(l.status),
    )
  ) {
    flash = "!Buku masih dipinjam / diajukan, tidak bisa dihapus";
    return aBooks();
  }
  if (confirm("Hapus buku ini?")) {
    db.books = db.books.filter((b) => b.id !== id);
    await save();
    flash = "Buku dihapus";
    aBooks();
  }
}

// Manajemen kategori: tambah kategori baru dan lihat jumlah buku tiap kategori.
function aCats() {
  $("#main").innerHTML =
    `${flashHTML()}<div class="banner grad"><div><h2>🏷 Kategori</h2><p>Kelola kategori buku</p></div></div>
  <form class="row" id="cf"><input name="c" placeholder="Nama kategori baru" required><button class="btn">+ Tambah</button></form>
  <table><tr><th>Kategori</th><th>Jumlah Buku</th><th>Aksi</th></tr>${db.categories.map((c, i) => `<tr><td>${esc(c)}</td><td>${db.books.filter((b) => b.cat === c).length}</td><td><button class="btn sm red" onclick="delCat(${i})">🗑</button></td></tr>`).join("")}</table>`;
  // Tambah kategori jika belum ada (tidak boleh duplikat).
  $("#cf").onsubmit = async (e) => {
    e.preventDefault();
    const c = new FormData(e.target).get("c").trim();
    if (c && !db.categories.includes(c)) {
      db.categories.push(c);
      await save();
    }
    aCats();
  };
}

// Hapus kategori, ditolak jika masih dipakai buku.
async function delCat(i) {
  const c = db.categories[i];
  if (db.books.some((b) => b.cat === c)) {
    flash = "!Kategori masih dipakai buku";
    return aCats();
  }
  db.categories.splice(i, 1);
  await save();
  aCats();
}

// Tabel peminjaman: tombol aksi berbeda sesuai status (Setujui/Tolak, Sudah Diambil/Batalkan, Kembalikan).
// Menampilkan durasi hari yang diminta anggota agar pustakawan tahu berapa hari buku dipinjam.
function aLoans() {
  $("#main").innerHTML =
    `${flashHTML()}<div class="banner grad"><div><h2>🔄 Peminjaman</h2><p>Setujui, tolak dan proses pengembalian buku (denda ${rp(DENDA_PER_HARI)}/hari, batas pengambilan ${db.pickupDays} hari setelah disetujui)</p></div></div>
  <table><tr><th>Peminjam</th><th>Buku</th><th>Durasi</th><th>Pinjam</th><th>Kembali / Batas Ambil</th><th>Status</th><th>Denda</th><th>Aksi</th></tr>
  ${
    db.loans
      .slice()
      .reverse()
      .map((l) => {
        // Ambil data peminjam dan buku dari memori
        const u = db.users.find((x) => x.id === l.userId) || {},
          b = db.books.find((x) => x.id === l.bookId) || {};
        // Tombol aksi disesuaikan dengan status terkini peminjaman
        const act =
          l.status === "Menunggu"
            ? `<button class="btn sm green" onclick="loanAct(${l.id},'ok')">Setujui</button> <button class="btn sm red" onclick="loanAct(${l.id},'no')">Tolak</button>`
            : l.status === "Dipinjam"
              ? `<button class="btn sm" onclick="loanAct(${l.id},'ret')">Kembalikan</button>`
              : l.status === "Siap Diambil"
                ? `<button class="btn sm green" onclick="loanAct(${l.id},'take')">Sudah Diambil</button> <button class="btn sm red" onclick="loanAct(${l.id},'cancel')">Batalkan</button>`
                : "-";
        // Tampilkan baris: durasi memuat l.days (default 7 hari jika data belum tercatat)
        return `<tr><td>${esc(u.name)}</td><td>${esc(b.title)}</td><td><b>${l.days || 7}</b> hari</td><td>${l.date}</td><td>${l.status === "Siap Diambil" ? "Ambil sebelum " + l.pickupBy : ["Menunggu", "Ditolak", "Booking Kedaluwarsa"].includes(l.status) ? "-" : l.due}</td><td>${statusTag(l)}</td><td>${fine(l) ? rp(fine(l)) : "-"}</td><td>${act}</td></tr>`;
      })
      .join("") || `<tr><td colspan="8">Belum ada peminjaman.</td></tr>`
  }</table>`;
}

// Proses aksi admin pada peminjaman, mengubah status dan stok buku.
async function loanAct(id, a) {
  const l = db.loans.find((x) => x.id === id);
  if (!l) return aLoans();
  const b = db.books.find((x) => x.id === l.bookId);
  // Disetujui → stok dipesan, anggota wajib mengambil sebelum batas waktu
  if (a === "ok") {
    if (l.status !== "Menunggu") return aLoans();
    if (!b || b.stock < 1) {
      flash = "!Stok buku habis";
      return aLoans();
    }
    b.stock--;
    l.status = "Siap Diambil";
    l.pickupBy = today(db.pickupDays);
    flash = "Booking disetujui, batas pengambilan " + l.pickupBy;
  }
  // Ditolak → status jadi "Ditolak".
  if (a === "no") {
    if (l.status !== "Menunggu") return aLoans();
    l.status = "Ditolak";
    flash = "Peminjaman ditolak";
  }
  // Buku sudah diambil → mulai dipinjam, tanggal pinjam & kembali dihitung dari hari ini.
  if (a === "take") {
    if (l.status !== "Siap Diambil") return aLoans();
    l.status = "Dipinjam";
    l.date = today();
    l.due = today(l.days || 7);
    flash = "Buku diambil, masa pinjam dimulai";
  }
  // Booking dibatalkan admin → kedaluwarsa, stok dikembalikan.
  if (a === "cancel") {
    if (l.status !== "Siap Diambil") return aLoans();
    l.status = "Booking Kedaluwarsa";
    if (b) b.stock++;
    flash = "Booking dibatalkan (kedaluwarsa)";
  }
  // Buku dikembalikan → denda dicatat, stok bertambah lagi.
  if (a === "ret") {
    if (l.status !== "Dipinjam") return aLoans();
    l.fine = fine(l);
    l.status = "Dikembalikan";
    if (b) b.stock++;
    flash = "Buku dikembalikan" + (l.fine ? ", denda " + rp(l.fine) : "");
  }
  await save();
  aLoans();
}

// Manajemen pengguna: tabel user + pencarian nama/email/NIM.
function aUsers() {
  const q = (window._uq || "").toLowerCase();
  const list = db.users.filter((u) =>
    (u.name + u.email + u.nim).toLowerCase().includes(q),
  );
  $("#main").innerHTML =
    `${flashHTML()}<div class="banner grad"><div><h2>👥 Manajemen Pengguna</h2><p>Kelola pengguna terdaftar</p></div></div>
  <div class="row"><input id="uq" placeholder="Cari berdasarkan nama, email, atau NIM..." value="${esc(window._uq || "")}"></div>
  <table><tr><th>Pengguna</th><th>Email</th><th>NIM</th><th>Telepon</th><th>Status</th><th>Peminjaman</th><th>Denda</th><th>Aksi</th></tr>
  ${list
    .map((u) => {
      const ls = db.loans.filter((l) => l.userId === u.id);
      return `<tr><td><b>${esc(u.name)}</b><br><small>${u.role === "admin" ? "Administrator" : "Bergabung " + u.created}</small></td><td>${esc(u.email)}</td><td>${esc(u.nim) || "-"}</td><td>${esc(u.phone) || "-"}</td>
    <td><span class="tag ${u.active ? "ok" : "bad"}">${u.active ? "Aktif" : "Nonaktif"}</span></td><td>${ls.filter((l) => l.status === "Dipinjam").length}</td><td>${rp(ls.reduce((s, l) => s + fine(l), 0))}</td>
    <td>${u.role === "admin" ? "-" : `<button class="btn sm" onclick="toggleUser(${u.id})">${u.active ? "Nonaktifkan" : "Aktifkan"}</button> <button class="btn sm red" onclick="delUser(${u.id})">🗑</button>`}</td></tr>`;
    })
    .join("")}</table>`;
  // Pencarian langsung saat mengetik.
  $("#uq").oninput = (e) => {
    window._uq = e.target.value;
    aUsers();
    $("#uq").focus();
    $("#uq").setSelectionRange(999, 999);
  };
}

// Aktifkan / nonaktifkan akun anggota.
async function toggleUser(id) {
  const u = db.users.find((x) => x.id === id);
  u.active = !u.active;
  await save();
  aUsers();
}

// Hapus pengguna: kembalikan stok buku yang masih dipegang, lalu hapus data & pinjamannya.
async function delUser(id) {
  if (confirm("Hapus pengguna?")) {
    db.loans
      .filter(
        (l) =>
          l.userId === id &&
          (l.status === "Dipinjam" || l.status === "Siap Diambil"),
      )
      .forEach((l) => {
        const b = db.books.find((x) => x.id === l.bookId);
        if (b) b.stock++;
      });
    db.users = db.users.filter((u) => u.id !== id);
    db.loans = db.loans.filter((l) => l.userId !== id);
    await save();
    aUsers();
  }
}

// Jumlah ulasan bertulisan yang belum dibalas / diubah setelah dibalas (untuk badge menu).
const reviewTodo = () =>
  (db.reviews || []).filter((r) => r.text && (!r.reply || r.reply.outdated))
    .length;
// Moderasi ulasan: lihat semua ulasan, filter rating & status balasan, balas / sunting / hapus balasan, hapus ulasan.
const REPLY_TEMPLATES = [
  [
    "🙏 Terima kasih",
    "Terima kasih banyak atas ulasannya! Senang sekali buku ini bermanfaat untukmu. Ditunggu ulasan buku berikutnya ya.",
  ],
  [
    "🛠 Kami tindak lanjuti",
    "Terima kasih atas masukannya. Catatan ini sudah kami teruskan ke tim pengelola koleksi dan akan segera kami tindak lanjuti.",
  ],
  [
    "📖 Rekomendasi",
    "Terima kasih sudah berbagi! Kalau kamu suka buku ini, coba juga lihat koleksi lain di kategori yang sama di katalog Libiverse.",
  ],
  [
    "✅ Sudah diperbaiki",
    "Terima kasih sudah memberi tahu. Informasi buku sudah kami periksa dan perbaiki. Selamat membaca kembali!",
  ],
];
function aReviews() {
  const f = +(window._rf || 0),
    st = window._rs || "";
  const all = (db.reviews || [])
    .slice()
    .sort(
      (a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id,
    );
  const needs = (r) => !r.reply || r.reply.outdated;
  const list = all.filter(
    (r) =>
      (!f || r.rating === f) && (!st || (st === "todo" ? needs(r) : !needs(r))),
  );
  const todo = all.filter(needs).length,
    done = all.length - todo;
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;
  $("#main").innerHTML =
    `${flashHTML()}<div class="banner grad starry"><div><h2>⭐ Ulasan & Rating</h2><p>Dengarkan pembaca, tanggapi dengan hangat, dan jaga ruang diskusi tetap sehat</p></div>
   <div class="ring" style="--v:${pct}" title="${pct}% ulasan sudah ditanggapi"><b>${pct}%</b><small>ditanggapi</small></div></div>
  <div class="rv-chips">
   ${[
     ["", `Semua (${all.length})`],
     ["todo", `✉️ Perlu Dibalas (${todo})`],
     ["done", `✅ Sudah Dibalas (${done})`],
   ]
     .map(
       ([v, t]) =>
         `<button class="chip ${st === v ? "on" : ""}" onclick="window._rs='${v}';aReviews()">${t}</button>`,
     )
     .join("")}
   <select id="rf" style="max-width:200px;margin-left:auto"><option value="0">Semua Rating</option>${[5, 4, 3, 2, 1].map((v) => `<option value="${v}" ${v === f ? "selected" : ""}>${"★".repeat(v)} (${all.filter((r) => r.rating === v).length})</option>`).join("")}</select></div>
  <div class="rv-admin-list">${
    list
      .map((r, i) => {
        const b = db.books.find((x) => x.id === r.bookId) || {},
          u = db.users.find((x) => x.id === r.userId) || {};
        return `<article class="rv-acard ${needs(r) ? "todo" : ""}" style="--i:${i}">
     <div class="rv-top"><div class="rv-book">${b.img ? `<img src="${esc(b.img)}" alt="">` : `<span>📘</span>`}<div><b>${esc(b.title || "(buku dihapus)")}</b><small>${esc(b.author || "")}</small></div></div>
      <span class="rv-state ${needs(r) ? (r.reply ? "warn" : "") : "ok"}">${!r.reply ? "Belum dibalas" : r.reply.outdated ? "Ulasan diubah" : "Sudah dibalas"}</span></div>
     <div class="rv-head"><span class="rv-ava">${esc((u.name || r.name || "?")[0])}</span><div><b>${esc(u.name || r.name)}</b><br>${starsHTML(r.rating)} <small>${esc(r.date)}</small></div></div>
     ${r.text ? `<p class="rv-text">${esc(r.text)}</p>` : `<p class="rv-text muted"><i>(hanya memberi rating, tanpa teks)</i></p>`}
     ${replyHTML(r)}
     <div class="rv-foot">
      <button class="btn sm" onclick="openReply(${r.id})">${r.reply ? "✏️ Sunting Balasan" : "💬 Balas Ulasan"}</button>
      ${r.reply ? `<button class="btn sm out" onclick="delReply(${r.id})">↩ Hapus Balasan</button>` : ""}
      <button class="btn sm red" style="margin-left:auto" title="Hapus ulasan" onclick="delReview(${r.id}, ${r.bookId})">🗑 Hapus Ulasan</button>
     </div></article>`;
      })
      .join("") ||
    `<div class="empty-state"><span>🌙</span><p>${st === "todo" ? "Semua ulasan sudah ditanggapi. Kerja bagus!" : "Belum ada ulasan di sini."}</p></div>`
  }</div>`;
  $("#rf").onchange = (e) => {
    window._rf = e.target.value;
    aReviews();
  };
}

// Modal balasan: textarea + penghitung karakter + template cepat + pratinjau langsung.
function openReply(id) {
  const r = (db.reviews || []).find((x) => x.id === id);
  if (!r) return;
  const b = db.books.find((x) => x.id === r.bookId) || {};
  $("#modal").innerHTML =
    `<div class="modal" onclick="if(event.target===this)closeModal()"><div class="card reply-card">
   <h3>${r.reply ? "✏️ Sunting Tanggapan" : "💬 Balas Ulasan"}</h3><p class="txt">untuk <b>${esc(r.name)}</b> · ${esc(b.title || "")}</p>
   <blockquote class="rv-quote">${starsHTML(r.rating)}<br>${r.text ? esc(r.text) : "<i>(tanpa teks)</i>"}</blockquote>
   <div class="tpl">${REPLY_TEMPLATES.map((t, i) => `<button type="button" class="chip" onclick="useTpl(${i})">${t[0]}</button>`).join("")}</div>
   <textarea id="replyText" rows="5" maxlength="1000" placeholder="Tulis tanggapan yang ramah dan membantu…" oninput="replyCount()">${esc(r.reply ? r.reply.text : "")}</textarea>
   <div class="reply-meta"><span id="replyErr" class="rv-err"></span><small id="replyCnt">0 / 1000</small></div>
   <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn out" onclick="closeModal()">Batal</button><button class="btn" id="replySave" onclick="submitReply(${id})">💾 Simpan Balasan</button></div>
  </div></div>`;
  replyCount();
  setTimeout(() => $("#replyText") && $("#replyText").focus(), 50);
}
function useTpl(i) {
  const t = $("#replyText");
  t.value = REPLY_TEMPLATES[i][1];
  replyCount();
  t.focus();
}
function replyCount() {
  const t = $("#replyText"),
    n = t.value.length;
  $("#replyCnt").textContent = `${n} / 1000`;
  $("#replyCnt").className = n > 900 ? "warn" : "";
}
async function submitReply(id) {
  const text = $("#replyText").value.trim();
  if (!text) {
    $("#replyErr").textContent = "Balasan tidak boleh kosong";
    return;
  }
  if (text.length > 1000) {
    $("#replyErr").textContent = "Balasan maksimal 1000 karakter";
    return;
  }
  $("#replySave").disabled = true;
  $("#replySave").textContent = "Menyimpan…";
  try {
    db = await apiReply(id, text);
    me = currentUser();
    closeModal();
    flash = "✅ Tanggapan pustakawan tersimpan & tampil di halaman anggota.";
    render();
  } catch (e) {
    $("#replyErr").textContent = e.message;
    $("#replySave").disabled = false;
    $("#replySave").textContent = "💾 Simpan Balasan";
  }
}
async function delReply(id) {
  if (!confirm("Hapus balasan untuk ulasan ini?")) return;
  try {
    db = await apiReplyDelete(id);
    me = currentUser();
    flash = "Balasan dihapus";
  } catch (e) {
    flash = "!" + e.message;
  }
  render();
}
// Setelah ulasan dihapus: tampilkan pesan lalu muat ulang halaman ulasan.
function onReviewChange(bookId, msg) {
  flash = msg;
  render();
}

// ===== Pesan Masuk (Tanya Pustakawan) =====
// Jumlah percakapan yang menunggu balasan admin.
const waiting = () =>
  (db.threads || []).filter((t) => t.status === "Menunggu Balasan").length;

// Kotak masuk: daftar percakapan (kiri) + isi percakapan dan form balasan (kanan).
function aInbox() {
  const st = window._is ?? "Menunggu Balasan",
    tp = window._it || "",
    q = (window._iq || "").toLowerCase();
  const all = sortThreads(db.threads || []);
  const uname = (t) =>
    (db.users.find((u) => u.id === t.userId) || {}).name || "Anggota";
  const list = all.filter(
    (t) =>
      (!st || t.status === st) &&
      (!tp || t.topic === tp) &&
      (
        t.subject +
        uname(t) +
        msgsOf(t.id)
          .map((m) => m.text)
          .join(" ")
      )
        .toLowerCase()
        .includes(q),
  );
  const cur = all.find((t) => t.id === window._ith);
  const cnt = (s) => all.filter((t) => !s || t.status === s).length;
  $("#main").innerHTML =
    `${flashHTML()}<div class="banner grad"><div><h2>💬 Pesan Masuk</h2><p>Balas pertanyaan, usulan buku, dan kendala denda dari anggota</p></div></div>
  <div class="chips">${["Menunggu Balasan", "Dibalas", "Selesai", ""].map((s) => `<a class="chip ${s === st ? "on" : ""}" onclick="window._is='${s}';aInbox()">${s || "Semua"} (${cnt(s)})</a>`).join("")}</div>
  <div class="row"><input id="iq" placeholder="Cari judul, nama anggota, atau isi pesan..." value="${esc(window._iq || "")}">
   <select id="it" style="max-width:240px"><option value="">Semua Topik</option>${Object.entries(
     TOPIK,
   )
     .map(
       ([k, v]) =>
         `<option value="${k}" ${k === tp ? "selected" : ""}>${v}</option>`,
     )
     .join("")}</select></div>
  <div class="inbox"><div class="card th-list">${list.map((t) => threadRowAdmin(t, uname(t))).join("") || `<p class="txt" style="padding:20px;text-align:center">Tidak ada pesan.</p>`}</div>
   <div class="card thread">${cur ? adminThread(cur) : `<div class="empty-th"><p style="font-size:40px">📭</p><p class="txt">Pilih percakapan di sebelah kiri untuk membaca dan membalas.</p></div>`}</div></div>`;
  $("#iq").oninput = (e) => {
    window._iq = e.target.value;
    aInbox();
    $("#iq").focus();
    $("#iq").setSelectionRange(999, 999);
  };
  $("#it").onchange = (e) => {
    window._it = e.target.value;
    aInbox();
  };
  scrollChat();
}

function threadRowAdmin(t, name) {
  const ms = msgsOf(t.id),
    last = ms[ms.length - 1];
  return `<a class="th-row ${t.unreadAdmin ? "unread" : ""} ${window._ith === t.id ? "on" : ""}" onclick="openInbox(${t.id})">
   <div class="th-main"><div><span class="tag">${TOPIK[t.topic] || t.topic}</span> <span class="tag ${THREAD_CLS[t.status] ?? ""}">${t.status}</span></div>
   <b>${esc(t.subject)}</b><small>👤 ${esc(name)} · ${last ? esc(last.text.slice(0, 70)) + (last.text.length > 70 ? "…" : "") : ""}</small></div>
   <small class="th-time">${fmtTime(t.updated)}</small></a>`;
}

// Isi percakapan untuk admin + info anggota (berguna untuk kendala denda).
function adminThread(t) {
  const u = db.users.find((x) => x.id === t.userId) || {},
    ls = db.loans.filter((l) => l.userId === t.userId);
  return `<div class="th-top"><div><span class="tag">${TOPIK[t.topic] || t.topic}</span> <span class="tag ${THREAD_CLS[t.status] ?? ""}">${t.status}</span><h3>${esc(t.subject)}</h3>
    <small class="txt">👤 <b>${esc(u.name)}</b> · ${esc(u.email)} · NIM ${esc(u.nim) || "-"} · Pinjaman aktif ${ls.filter((l) => l.status === "Dipinjam").length} · Denda ${rp(ls.reduce((s, l) => s + fine(l), 0))}</small></div>
    ${t.status === "Selesai" ? `<button class="btn sm out" onclick="setThread(${t.id},'Buka')">↺ Buka Kembali</button>` : `<button class="btn sm green" onclick="setThread(${t.id},'Selesai')">✔ Tandai Selesai</button>`}</div>
   ${chatHTML(t, "admin")}
   <div class="reply"><textarea id="rt" rows="3" maxlength="2000" placeholder="Tulis balasan untuk ${esc(u.name)}..." oninput="draftInput('a${t.id}', this)">${esc(drafts["a" + t.id] || "")}</textarea>
    <button class="btn" onclick="adminReply(${t.id})">📨 Balas</button></div>`;
}

// Buka percakapan: tampilkan, lalu tandai sudah dibaca admin.
async function openInbox(id) {
  window._ith = id;
  aInbox();
  const t = db.threads.find((x) => x.id === id);
  if (t && t.unreadAdmin) {
    try {
      db = await api("/api/msg/update", { threadId: id, read: true });
      me = currentUser();
    } catch {}
  }
}

async function adminReply(id) {
  const text = $("#rt").value.trim();
  if (!text) return $("#rt").focus();
  try {
    db = await api("/api/msg/reply", { threadId: id, text });
    me = currentUser();
    delete drafts["a" + id];
    flash = "Balasan terkirim ke anggota";
  } catch (err) {
    flash = "!" + err.message;
  }
  render();
}

async function setThread(id, status) {
  try {
    db = await api("/api/msg/update", { threadId: id, status });
    me = currentUser();
    flash =
      status === "Selesai"
        ? "Percakapan ditandai selesai"
        : "Percakapan dibuka kembali";
  } catch (err) {
    flash = "!" + err.message;
  }
  render();
}

// Cek pesan baru tiap 20 detik: perbarui angka di menu, dan kotak masuk jika admin tidak sedang mengetik.
setInterval(async () => {
  if (!me || document.hidden || $("#modal").innerHTML) return;
  try {
    await loadState();
    me = currentUser();
  } catch {
    return;
  }
  const typing = ["TEXTAREA", "INPUT"].includes(document.activeElement.tagName);
  if (!typing && ["#inbox", "#dashboard", ""].includes(location.hash)) render();
  else
    document.querySelectorAll(".side a").forEach((a) => {
      if (a.textContent.startsWith("💬"))
        a.innerHTML =
          "💬 Pesan Masuk" +
          (waiting() ? ` <span class="pill">${waiting()}</span>` : "");
    });
}, 20000);

// Wajib login sebagai admin, lalu tampilkan menu sesuai hash (#dashboard, #books, dst).
function render() {
  if (!requireLogin("admin")) return;
  adminPage("admin/" + (location.hash.slice(1) || "dashboard"));
}

// Render ulang saat hash URL berubah.
window.addEventListener("hashchange", render);
boot();
