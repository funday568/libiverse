// ===== register.js =====
// Tampilkan form pendaftaran akun baru dengan data lengkap (Nama, NIM, No HP, Alamat, Email, Password).
function register() {
  app.innerHTML =
    `<div class="auth"><div class="card"><h2>Daftar Akun</h2><p class="s">Buat akun untuk mengakses perpustakaan digital Libiverse</p>${flashHTML()}
   <form id="f">
    <label>Nama Lengkap</label>
    <input name="name" placeholder="Nama lengkap Anda" required>

    <label>NIM (Nomor Induk Mahasiswa)</label>
    <input name="nim" pattern="[A-Za-z0-9]{5,20}" title="5-20 huruf/angka" placeholder="Contoh: 2605090063" required>
` +
    // INPUT BARU: Nomor Telepon/WhatsApp untuk notifikasi peminjaman
    `    <label>Nomor Telepon / WhatsApp</label>
    <input name="phone" type="tel" placeholder="Contoh: 081234567890" required>
` +
    // INPUT BARU: Alamat domisili lengkap
    `    <label>Alamat Lengkap</label>
    <textarea name="address" rows="2" placeholder="Masukkan alamat lengkap domisili kamu" required></textarea>

    <label>Alamat Email</label>
    <input name="email" type="email" placeholder="contoh@email.com" required>
` +
    // FITUR BARU: Input password dengan tombol intip/sembunyikan (toggle mata)
    `    <label>Password</label>
    <div class="pwd-wrap">
      <input name="password" type="password" minlength="8" placeholder="Minimal 8 karakter" required>
      <button type="button" class="pwd-toggle" aria-label="Lihat password" title="Lihat password" onclick="togglePwd(this)">${EYE_ICON}</button>
    </div>
` +
    // FITUR BARU: Input konfirmasi password dengan tombol intip/sembunyikan (toggle mata)
    `    <label>Konfirmasi Password</label>
    <div class="pwd-wrap">
      <input name="password2" type="password" placeholder="Ulangi password Anda" required>
      <button type="button" class="pwd-toggle" aria-label="Lihat password" title="Lihat password" onclick="togglePwd(this)">${EYE_ICON}</button>
    </div>

    <button class="btn">Daftar</button>
   </form>
   <p class="s" style="margin-top:14px">Sudah punya akun? <a onclick="go('login')">Masuk</a></p></div></div>`;

  // Saat form dikirim: validasi konfirmasi password, kirim ke server, lalu arahkan ke login
  $("#f").onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    f.email = f.email.trim().toLowerCase();
    f.name = f.name.trim();

    if (f.password !== f.password2) {
      flash = "!Konfirmasi password tidak sama";
      return register();
    }

    try {
      // Mengirimkan phone dan address ke API server
      await api("/api/register", {
        name: f.name,
        nim: f.nim,
        phone: (f.phone || "").trim(),
        address: (f.address || "").trim(),
        email: f.email,
        password: f.password,
      });
    } catch (err) {
      flash = "!" + err.message;
      return register();
    }

    flash = "Registrasi berhasil, silakan masuk dengan akun baru Anda";
    go("login");
  };
}

// Dipanggil boot(): tampilkan halaman daftar
function render() {
  register();
}
boot();
