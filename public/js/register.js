// ===== register.js =====
// Tampilkan form pendaftaran akun baru dengan data lengkap (Nama, NIM, No HP, Alamat, Email, Password).
function register() {
  app.innerHTML =
    `<div class="auth"><div class="card"><h2>Daftar Akun</h2><p class="s">Buat akun untuk mengakses perpustakaan digital Libiverse</p><div id="err">${flashHTML()}</div>
   <form id="f" novalidate>
    <label>Nama Lengkap</label>
    <input name="name" placeholder="Nama lengkap Anda" required>

    <label>NIM (Nomor Induk Mahasiswa)</label>
    <input name="nim" pattern="[A-Za-z0-9]{5,20}" title="5-20 huruf/angka" placeholder="Contoh: 2605090063" required>
` +
    // INPUT BARU: Nomor Telepon/WhatsApp untuk notifikasi peminjaman
    `    <label>Nomor Telepon / WhatsApp</label>
    <input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="Contoh: 081234567890" required>
    <small style="display:block;margin:-6px 0 12px;color:var(--mu)">Boleh ditulis 0812…, +62 812…, atau dengan spasi/tanda hubung.</small>
` +
    // INPUT BARU: Alamat domisili lengkap
    `    <label>Alamat Lengkap</label>
    <textarea name="address" rows="2" placeholder="Masukkan alamat lengkap domisili kamu" required></textarea>

    <label>Alamat Email</label>
    <input name="email" type="email" autocomplete="email" placeholder="contoh@email.com" required>
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

  // Saat form dikirim: cek isian di browser, kirim ke server, lalu arahkan ke login.
  // Error ditampilkan di kolom yang salah, jadi isian lain tidak perlu diketik ulang.
  const form = $("#f");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const empty = [...form.elements].find((el) => el.required && !el.value.trim());
    if (empty) return fieldError(form, empty.name, "Kolom ini wajib diisi");
    const bad = cekKontak(f);
    if (bad) return fieldError(form, ...bad);
    if (f.password.length < 8) return fieldError(form, "password", "Password minimal 8 karakter");
    if (f.password !== f.password2) return fieldError(form, "password2", "Konfirmasi password tidak sama");

    const btn = form.querySelector("button.btn");
    btn.disabled = true;
    btn.textContent = "Mendaftarkan…";
    try {
      await api("/api/register", {
        name: f.name.trim(),
        nim: f.nim.trim(),
        phone: normPhone(f.phone),
        address: f.address.trim(),
        email: f.email.trim().toLowerCase(),
        password: f.password,
      });
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Daftar";
      // Arahkan pesan server ke kolom terkait (email/NIM/HP sudah dipakai, dll.)
      const field = /email/i.test(err.message) ? "email" : /NIM/.test(err.message) ? "nim" : /HP/.test(err.message) ? "phone" : null;
      if (field) return fieldError(form, field, err.message);
      $("#err").innerHTML = `<div class="alert err">${esc(err.message)}</div>`;
      return;
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
