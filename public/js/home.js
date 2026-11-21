// ===== home.js =====
// Halaman beranda (landing page).
// Susun tampilan beranda: navigasi, hero, fitur, statistik, dan footer.
function home() {
  const navR = me
    ? `<a class="lp-btn lp-btn-p" onclick="go('${me.role === "admin" ? "admin" : "catalog"}')">Dashboard</a>`
    : `<a class="lp-btn lp-btn-g" onclick="go('login')">Masuk</a><a class="lp-btn lp-btn-p" onclick="go('register')">Daftar</a>`;
  const latest = [...db.books].sort((a, b) => b.id - a.id).slice(0, 6);
  const fmt = (n) => Number(n || 0).toLocaleString("id-ID");
  app.innerHTML =
    `<div class="lp">
  <nav class="lp-nav" id="lpnav"><div class="lp-in lp-nav-in">
   <a class="logo" href="#home">📚 Libiverse</a>
   <button class="lp-burger" aria-label="Menu" onclick="document.getElementById('lpnav').classList.toggle('open')">☰</button>
   <div class="lp-links"><a href="#home">Home</a><a href="#katalog">Katalog</a><a href="#fitur">Fitur</a><a href="#statistik">Statistik</a></div>
   <div class="lp-auth">${navR}</div></div></nav>

  <header class="lp-hero" id="home"><div class="lp-in lp-hero-in">
   <div class="lp-hero-txt lp-rv">
    <span class="lp-pill">✨ Perpustakaan Digital Modern</span>
    <h1>Temukan Dunia Baru <span>Melalui Buku</span></h1>
    <p>Jelajahi ${fmt(db.stats.books)} koleksi buku dari ${fmt(db.stats.categories)} kategori, pinjam dengan mudah, dan pantau status peminjaman Anda kapan saja.</p>
    <form class="lp-search" onsubmit="event.preventDefault();heroSearch()">
     <span>🔍</span><input id="heroq" placeholder="Cari judul atau penulis buku..." autocomplete="off"><button class="lp-btn lp-btn-p" type="submit">Cari</button></form>
    <div class="lp-hero-cta"><a class="lp-btn lp-btn-w" href="#katalog">📖 Jelajahi Katalog</a>${me ? "" : `<a class="lp-btn lp-btn-o" onclick="go('register')">Daftar Gratis →</a>`}</div>
   </div>
   <div class="lp-hero-art lp-rv">${latest
     .slice(0, 3)
     .map(
       (b, i) =>
         `<div class="lp-float f${i}" ${cover(b)}>${b.img ? "" : esc(b.title)}</div>`,
     )
     .join("")}</div>
  </div></header>

  <section class="lp-sec" id="terbaru"><div class="lp-in">
   <div class="lp-head lp-head-row lp-rv"><div><span class="lp-eyebrow">Koleksi</span><h2>Buku Terbaru</h2></div><a class="lp-btn lp-btn-g" href="#katalog">Lihat semua →</a></div>
   <div class="lp-latest">${latest.map((b) => `<article class="lp-bk lp-rv" onclick="hDetail(${b.id})"><div class="lp-cv" ${cover(b)}>${b.img ? "" : esc(b.title)}</div><span class="tag">${esc(b.cat)}</span><h4>${esc(b.title)}</h4><small>${esc(b.author)}</small>${ratingBadge(b.id)}</article>`).join("") || "<p>Belum ada buku.</p>"}</div>
  </div></section>
` +
    `  <section class="lp-sec lp-cat-sec" id="katalog"><div class="lp-in">
   <div class="lp-head lp-rv"><span class="lp-eyebrow">Katalog</span><h2>Katalog Buku</h2><p>Jelajahi seluruh koleksi Libiverse — tanpa perlu login.</p></div>
   <div class="row hcat-tools"><input id="hq" placeholder="Cari judul atau penulis..."><select id="hc"><option value="">Semua Kategori</option>${db.categories.map((x) => `<option>${esc(x)}</option>`).join("")}</select></div>
   <div class="chips" id="hchips">
     <a class="chip on" data-c="">Semua</a>
     ${db.categories
       .slice(0, 5)
       .map((x) => `<a class="chip" data-c="${esc(x)}">${esc(x)}</a>`)
       .join("")}
     ${db.categories.length > 5 ? `<button type="button" class="chip chip-toggle" id="hcat-more-btn" onclick="toggleMoreCat()">Kategori Lainnya ▾</button>` : ""}
   </div>
   ${
     db.categories.length > 5
       ? `
     <div id="hcat-more" class="chips-more" style="display:none">
       ${db.categories
         .slice(5)
         .map((x) => `<a class="chip" data-c="${esc(x)}">${esc(x)}</a>`)
         .join("")}
     </div>
   `
       : ""
   }
   <div id="hlist"></div></div></section>

  <section class="lp-sec" id="fitur"><div class="lp-in">
   <div class="lp-head lp-rv"><span class="lp-eyebrow">Fitur Utama</span><h2>Semua yang Anda butuhkan</h2><p>Kelola perpustakaan digital secara efisien dalam satu platform.</p></div>
   <div class="lp-feats">
    ${[
      [
        "📖",
        "Katalog Buku",
        "Jelajahi koleksi berdasarkan kategori, lengkap dengan sinopsis dan detail buku.",
        "#katalog",
      ],
      [
        "🔄",
        "Peminjaman",
        "Ajukan pinjaman secara online dan pantau statusnya secara real-time.",
        me ? "javascript:go('borrowing')" : "javascript:go('login')",
      ],
      [
        "👥",
        "Manajemen Pengguna",
        "Admin mengelola akun anggota, status peminjaman, dan denda keterlambatan.",
        me && me.role === "admin"
          ? "javascript:go('admin/users')"
          : "javascript:go('login')",
      ],
    ]
      .map(
        ([i, t, d, h]) =>
          `<a class="lp-feat lp-rv" href="${h}"><div class="lp-ic">${i}</div><h3>${t}</h3><p>${d}</p><span class="lp-more">Selengkapnya →</span></a>`,
      )
      .join("")}
   </div></div></section>

  <section class="lp-sec lp-stats-sec" id="statistik"><div class="lp-in">
   <div class="lp-head lp-rv"><span class="lp-eyebrow lp-eyebrow-l">Statistik</span><h2>Libiverse dalam angka</h2></div>
   <div class="lp-stats">
    ${[
      ["📚", db.stats.books, "Total Buku"],
      ["👤", db.stats.users, "Pengguna"],
      ["🏷️", db.stats.categories, "Kategori"],
      ["🔁", db.stats.loans, "Peminjaman"],
    ]
      .map(
        ([i, n, l]) =>
          `<div class="lp-stat lp-rv"><span class="lp-si">${i}</span><b data-n="${Number(n) || 0}">0</b><span>${l}</span></div>`,
      )
      .join("")}
   </div></div></section>

  <footer class="lp-foot"><div class="lp-in lp-foot-in">
   <div><span class="logo">📚 Libiverse</span><p>Perpustakaan digital modern untuk institusi pendidikan.</p></div>
   <div class="lp-foot-links"><a href="#home">Home</a><a href="#katalog">Katalog</a><a href="#fitur">Fitur</a><a href="#statistik">Statistik</a><a onclick="go(me && me.role !== 'admin' ? 'help' : me ? 'admin/inbox' : 'login')">💬 Tanya Pustakawan</a>${me ? "" : `<a onclick="go('login')">Masuk</a>`}</div>
  </div><div class="lp-in lp-copy">© ${new Date().getFullYear()} Libiverse — Perpustakaan Digital oleh Fandili Setia Dwi Yanto</div></footer>
  </div>`;
}

function heroSearch() {
  $("#hq").value = $("#heroq").value;
  homePage = 1;
  homeList();
  document.getElementById("katalog").scrollIntoView({ behavior: "smooth" });
}

function homeFx() {
  const nav = document.getElementById("lpnav");
  const onScroll = () => nav.classList.toggle("scrolled", scrollY > 10);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  document
    .querySelectorAll(".lp-links a, .lp-foot-links a")
    .forEach((a) =>
      a.addEventListener("click", () => nav.classList.remove("open")),
    );
  const count = (el) => {
    const n = +el.dataset.n,
      t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 900);
      el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))).toLocaleString(
        "id-ID",
      );
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".lp-rv").forEach((e) => e.classList.add("in"));
    document.querySelectorAll(".lp-stat b").forEach(count);
    return;
  }
  const io = new IntersectionObserver(
    (es) =>
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        const b = e.target.querySelector(".lp-stat b, b[data-n]");
        if (e.target.classList.contains("lp-stat") && b) count(b);
        io.unobserve(e.target);
      }),
    { threshold: 0.15 },
  );
  document.querySelectorAll(".lp-rv").forEach((e) => io.observe(e));
}

// Buka / tutup pilihan kategori tambahan
function toggleMoreCat() {
  const el = document.getElementById("hcat-more");
  const btn = document.getElementById("hcat-more-btn");
  if (!el || !btn) return;
  const isHidden = el.style.display === "none";
  el.style.display = isHidden ? "flex" : "none";
  btn.innerHTML = isHidden ? "Tutup ▴" : "Kategori Lainnya ▾";
}

let homePage = 1;
let homePerPage = 12; // disesuaikan otomatis dengan jumlah kolom (lihat perPageFor)

let _rzHome;
addEventListener("resize", () => {
  clearTimeout(_rzHome);
  _rzHome = setTimeout(() => {
    if ($("#hlist") && perPageFor(".hbooks") !== homePerPage) homeList();
  }, 200);
});

function changeHomePage(p) {
  homePage = p;
  homeList();
  const el = document.getElementById("katalog");
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

// Isi daftar buku katalog beranda sesuai kata kunci & kategori (dengan paginasi).
function homeList(fit = true) {
  const q = ($("#hq").value || "").toLowerCase(),
    c = $("#hc").value;
  const list = db.books.filter(
    (b) =>
      (!c || b.cat === c) &&
      (b.title + " " + b.author).toLowerCase().includes(q),
  );
  document.querySelectorAll("#hchips .chip, #hcat-more .chip").forEach((x) => {
    if (x.dataset.c !== undefined) {
      x.classList.toggle("on", x.dataset.c === c);
    }
  });

  const moreEl = document.getElementById("hcat-more");
  const moreBtn = document.getElementById("hcat-more-btn");
  if (c && moreEl && moreEl.querySelector(`[data-c="${CSS.escape(c)}"]`)) {
    moreEl.style.display = "flex";
    if (moreBtn) moreBtn.innerHTML = "Tutup ▴";
  }

  const totalPages = Math.ceil(list.length / homePerPage) || 1;
  if (homePage > totalPages) homePage = 1;
  if (homePage < 1) homePage = 1;
  const start = (homePage - 1) * homePerPage;
  const paged = list.slice(start, start + homePerPage);

  const pagHTML = pagerHTML(homePage, totalPages, list.length, "changeHomePage");

  $("#hlist").innerHTML =
    `<p class="hcount">${list.length} buku ditemukan</p><div class="hbooks">${
      paged
        .map(
          (b) => `
   <article class="hbook"><div class="cv" ${cover(b)}>${b.img ? "" : esc(b.title)}<span class="stock ${b.stock < 1 ? "no" : ""}">${b.stock < 1 ? "Habis" : "Stok " + b.stock}</span></div>
    <div class="in"><span class="tag">${esc(b.cat)}</span><h4>${esc(b.title)}</h4>${ratingBadge(b.id)}<small>✍️ ${esc(b.author)}</small>
    <p class="syn">${esc(b.synopsis || b.abstract) || "<i>Belum ada sinopsis.</i>"}</p>
    <div class="acts"><button class="btn sm out" onclick="hDetail(${b.id})">👁 Lihat Detail</button><button class="btn sm" ${b.stock < 1 ? "disabled" : ""} onclick="requestBorrow(${b.id})">📥 Pinjam</button></div></div></article>`,
        )
        .join("") || "<p>Tidak ada buku yang cocok.</p>"
    }</div>` + pagHTML;
  // Penuhi baris terakhir: jumlah per halaman = kelipatan jumlah kolom yang tampil.
  const per = perPageFor(".hbooks");
  if (fit && per !== homePerPage) {
    homePage = Math.floor(start / per) + 1;
    homePerPage = per;
    homeList(false);
  }
}

function hDetail(id) {
  const b = db.books.find((x) => x.id === id);
  if (!b) return;
  $("#modal").innerHTML =
    `<div class="modal" onclick="if(event.target===this)closeModal()"><div class="card hdetail">
   <div class="hd-top"><div class="cv" ${cover(b)}>${b.img ? "" : esc(b.title)}</div>
   <div><span class="tag">${esc(b.cat)}</span><h3>${esc(b.title)}</h3>${ratingBadge(b.id)}<p class="txt">Penulis: <b>${esc(b.author)}</b><br>Penerbit: ${esc(b.publisher)}<br>Tahun: ${esc(b.year)}<br>ISBN: ${esc(b.isbn)}<br>Stok: ${b.stock}</p></div></div>
   <h4>📝 Abstrak</h4><p class="txt">${esc(b.abstract) || "<i>Belum ada abstrak.</i>"}</p><br>
   <h4>📖 Sinopsis</h4><p class="txt">${esc(b.synopsis) || "<i>Belum ada sinopsis.</i>"}</p><br>
   <h4>⭐ Ulasan & Rating Pembaca</h4>${reviewsHTML(b.id, false)}<p class="txt rv-note">ⓘ ${me ? "Beri ulasan dari halaman Katalog setelah kamu meminjam buku ini." : "Masuk dan pinjam buku ini untuk memberi rating & ulasan."}</p><br>
   ${me ? "" : `<div class="alert">🔒 Login terlebih dahulu untuk mengajukan peminjaman.</div>`}
   <button class="btn" ${b.stock < 1 ? "disabled" : ""} onclick="requestBorrow(${b.id})">📥 Request Peminjaman</button> <button class="btn out" onclick="closeModal()">Tutup</button></div></div>`;
}

function requestBorrow(id) {
  sessionStorage.setItem("libiverse_pending_book", id);
  if (!me) {
    flash = "!Silakan login terlebih dahulu untuk meminjam buku";
    return go("login");
  }
  if (me.role === "admin") {
    sessionStorage.removeItem("libiverse_pending_book");
    closeModal();
    return alert("Akun admin tidak dapat meminjam buku.");
  }
  go("catalog");
}

function render() {
  me = currentUser();
  home();
  $("#hq").oninput = () => {
    homePage = 1;
    homeList();
  };
  $("#hc").onchange = () => {
    homePage = 1;
    homeList();
  };
  document.querySelectorAll("#hchips .chip, #hcat-more .chip").forEach((x) => {
    if (x.dataset.c !== undefined) {
      x.onclick = () => {
        $("#hc").value = x.dataset.c;
        homePage = 1;
        homeList();
      };
    }
  });
  homeList();
  homeFx();
}
boot();
