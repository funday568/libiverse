// ===== login.js =====
// Tampilkan form login.
function login() {
  app.innerHTML = `<div class="auth"><div class="card"><h2>📚 Masuk</h2><p class="s">Masuk ke akun perpustakaan digital</p>${flashHTML()}
   <form id="f"><label>Email</label><input name="email" type="email" required>
   <label>Password</label>
    <div class="pwd-wrap">
     <input name="password" type="password" placeholder="Masukkan password Anda" required>
     <button type="button" class="pwd-toggle" aria-label="Lihat password" title="Lihat password" onclick="togglePwd(this)">${EYE_ICON}</button>
    </div>
   <button class="btn">Masuk</button></form>
   <p class="s" style="margin-top:14px">Belum punya akun? <a onclick="go('register')">Daftar</a> · <a onclick="go('home')">Beranda</a></p></div></div>`;
  // Saat form dikirim: cek email & password ke server, lalu arahkan ke admin atau katalog.
  $("#f").onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try {
      const u = await api("/api/login", {
        email: f.email,
        password: f.password,
      });
      flash = "Selamat datang, " + u.name;
      go(u.role === "admin" ? "admin" : "catalog");
    } catch (err) {
      flash = "!" + err.message;
      login();
    }
  };
}

// Dipanggil boot(): tampilkan halaman login.
function render() {
  login();
}
boot();
