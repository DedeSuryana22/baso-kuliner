# Baso Kuliner — Order Online + Kasir POS

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
