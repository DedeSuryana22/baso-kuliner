# Baso Kuliner — Order Online + Kasir POS + Asisten AI (Ollama)

Satu proyek, dua cara jalan:

| Mode | Cara | Data pesanan | AI |
|---|---|---|---|
| **Python + Ollama (IDLE)** | buka `baso_kuliner.py` di IDLE → F5 | SQLite di laptop, **tersinkron ke semua HP di WiFi yang sama** | ✅ Chat pesan + Insight laporan |
| Web statis (GitHub Pages) | https://dedesuryana22.github.io/baso-kuliner/ | localStorage per HP | ❌ |

## Mode Python + Ollama — langkah instalasi (Windows)
1. **Python** 3.8+ dari python.org (centang *Add Python to PATH*). IDLE sudah ikut terpasang. Tidak perlu `pip install` apa pun.
2. **Ollama** dari https://ollama.com → install → buka Command Prompt, jalankan:
   ```
   ollama pull qwen2.5:3b
   ```
   (±2 GB, sekali saja. Laptop RAM 8 GB cukup. Kalau lemot, coba `qwen2.5:1.5b`; kalau ingin lebih pintar & RAM 16 GB, `qwen2.5:7b`. Ganti `OLLAMA_MODEL` di bagian atas `baso_kuliner.py`.)
3. Ekstrak folder ini → klik kanan `baso_kuliner.py` → **Edit with IDLE** → tekan **F5**.
4. Browser terbuka otomatis ke `http://localhost:8000`. IDLE Shell menampilkan alamat untuk HP, misalnya `http://192.168.1.7:8000`.
5. Stop: **Ctrl+C** di IDLE Shell, atau menu **Shell → Restart Shell**.

Kalau Ollama tidak jalan, aplikasi tetap berfungsi normal — hanya fitur AI yang disembunyikan.

### Fitur AI
- **Pesan via AI** (tombol 🤖 di halaman menu): customer mengetik bebas, misal *"baso urat taican 2 pedas, es mangga 1"* → otomatis masuk keranjang dengan catatan. Menu yang tidak ada (mis. "rendang") ditolak server, tidak bisa masuk keranjang.
- **Insight AI** (Kasir → Laporan): AI membaca angka laporan harian dan memberi poin insight + saran besok. Angka dihitung oleh aplikasi, AI hanya menafsirkan — tetap cek angka di kartu laporan.

### Catatan mode Python
- **HP lewat WiFi**: HP harus satu WiFi dengan laptop; jika tidak bisa dibuka, izinkan Python di Windows Firewall (*Allow access* saat muncul popup pertama kali).
- **GPS di HP via WiFi tidak jalan** (browser hanya mengizinkan GPS di HTTPS/localhost). Customer tetap bisa geser pin manual. Untuk customer dari luar, tetap pakai link GitHub Pages.
- **Laptop harus menyala** selama dipakai. Database: `data/baso_kuliner.db` — backup file ini atau export CSV rutin.
- Status pesanan yang diubah kasir belum tampil otomatis di riwayat HP customer.

## Mode web statis
Web app statis (HTML/CSS/JS + Leaflet/OpenStreetMap). Tanpa backend, tanpa API key, tanpa build step.

## Jalankan lokal
```bash
npx serve .            # atau: python3 -m http.server 3000
# buka http://localhost:3000   (kasir langsung: http://localhost:3000/#kasir)
npm test               # 16 unit test logika jarak, ongkir, pesan WA, laporan
```
GPS hanya jalan di `localhost` atau HTTPS (Vercel sudah HTTPS).

## Deploy gratis ke Vercel
**Cara 1 (paling cepat):** `npm i -g vercel` → di folder ini jalankan `vercel` → ikuti prompt → `vercel --prod`.
**Cara 2 (GitHub):** push folder ke repo GitHub → vercel.com → Add New Project → Import repo →
Framework Preset: **Other**, Build Command: kosong, Output Directory: `.` → Deploy.

## Yang WAJIB diedit sebelum live — `js/config.js`
| Item | Keterangan |
|---|---|
| `origin` | Koordinat lapak. Saat ini **estimasi** area Tambun Utara. Buka Google Maps → tekan lama titik lapak → salin angka. |
| `payment.seabank` | No. rekening & nama pemilik asli. |
| `payment.qrisImage` | Simpan gambar QRIS asli ke `assets/qris.png`, ubah path. File sekarang hanya contoh. |
| `kasirPin` | Ganti dari 1234. |
| `shipping.mode` | `full` (default): >2 km → seluruh jarak dibulatkan ke atas × Rp2.500 (3,1 km = Rp10.000). `excess`: hanya kelebihan dari 2 km (3,1 km = Rp5.000). |
| `shipping.distanceFactor` | Haversine = garis lurus. Isi `1.3` agar mendekati jarak jalan. |

## Struktur
```
baso_kuliner.py     server Python (IDLE F5): web + SQLite + Ollama
index.html          semua tampilan (Menu, Checkout, Riwayat, Kasir)
css/style.css       desain mobile-first
js/config.js        brand, menu, harga, ongkir, pembayaran, PIN
js/core.js          logika murni: Haversine, ongkir, format/parse WA, laporan, CSV
js/app.js           UI, keranjang, peta, kasir
vendor/leaflet/     Leaflet 1.9.4 (lokal, tidak bergantung CDN)
assets/             favicon, contoh QRIS
tests/              unit test (node)
```

## Batasan penting (baca!)
- **Data disimpan di localStorage per perangkat.** Order dari HP customer tidak otomatis masuk ke HP kasir.
  Alurnya: order masuk lewat WhatsApp → kasir salin pesan → menu **Kasir › Pesanan › Impor pesanan dari WhatsApp**.
  Jika ingin order masuk otomatis ke kasir, butuh database (mis. Google Sheets via Apps Script atau Supabase gratis).
- **PIN kasir hanya penghalang ringan** (tersimpan di kode JS, bisa dilihat siapa pun). Jangan simpan data sensitif.
- Clear data browser = data kasir hilang. **Export CSV/Excel tiap tutup lapak.**
- Pemakaian tile OpenStreetMap gratis untuk trafik kecil; jika ramai sekali, pertimbangkan penyedia tile lain.
