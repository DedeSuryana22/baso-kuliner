/* =========================================================
   BASO KULINER — KONFIGURASI
   Semua angka bisnis ada di file ini. Edit di sini saja.
   ========================================================= */
window.BK_CONFIG = {
  brand: {
    name: 'Baso Kuliner',
    tagline: 'Baso hangat, kuah nendang, langsung ke rumahmu',
    instagram: 'basokuliner.id',
    address: 'Perumahan Graha Cipta 5, Tambun Utara, Kab. Bekasi',
  },

  // Nomor WA admin (format internasional tanpa + / spasi)
  whatsappAdmin: '62895410651146',

  // Titik lapak (origin ongkir). ESTIMASI area Tambun Utara —
  // ganti dengan koordinat persis: buka Google Maps, tekan lama titik lapak,
  // salin angka "-6.xxxx, 107.xxxx".
  origin: { lat: -6.1985, lng: 107.0560 },

  // Aturan ongkir
  shipping: {
    freeRadiusKm: 2,       // <= 2 km gratis
    ratePerKm: 2500,       // Rp per km
    // 'full'   : jarak > 2 km -> seluruh jarak (dibulatkan ke atas) x tarif. 2,3 km = 3 x 2.500 = 7.500
    // 'excess' : hanya kelebihan dari 2 km yang ditagih. 2,3 km = 1 x 2.500 = 2.500
    mode: 'full',
    maxRadiusKm: 10,       // di luar radius ini order ditolak (0 = tanpa batas)
    // Haversine = jarak garis lurus. Jarak jalan biasanya 1,2–1,4x lebih jauh.
    // Isi 1.3 jika ingin ongkir mendekati jarak tempuh motor.
    distanceFactor: 1.0,
  },

  // Info pembayaran non-tunai (GANTI dengan data asli)
  payment: {
    qrisImage: 'assets/qris.svg',          // ganti dengan file QRIS asli, mis. assets/qris.png
    qrisMerchant: 'BASO KULINER',
    seabank: { bank: 'SeaBank', number: '9010 0000 0000', holder: 'NAMA PEMILIK REKENING' },
  },

  // PIN halaman kasir (hanya penghalang ringan, BUKAN keamanan sungguhan)
  kasirPin: '1234',

  // Pilihan catatan cepat di tiap menu
  noteOptions: {
    makanan: ['Tidak pedas', 'Pedas sedang', 'Pedas banget', 'Tanpa seledri', 'Tanpa bawang goreng', 'Kuah dipisah'],
    minuman: ['Less sugar', 'Es dipisah', 'Tanpa es'],
  },

  menu: [
    { id: 'aci-ambyar',    name: 'Baso Aci Ambyar',          price: 10000, category: 'makanan',
      desc: 'Baso aci kenyal, cuanki, tahu, kerupuk & sambal ambyar yang bikin nagih.', palette: ['#E63946', '#F4A261'], badge: 'Best Seller' },
    { id: 'urat-taican',   name: 'Baso Urat Kuah Taican',    price: 14000, category: 'makanan',
      desc: 'Baso urat sapi padat dengan kuah taican pedas gurih beraroma cabai.', palette: ['#D62828', '#F77F00'], badge: 'Pedas' },
    { id: 'urat-original', name: 'Baso Urat Kuah Original',  price: 14000, category: 'makanan',
      desc: 'Baso urat sapi, kuah kaldu bening original, mi & sawi segar.', palette: ['#E9A23B', '#F6D186'] },
    { id: 'pentol-taican', name: 'Baso Pentol Kuah Taican',  price: 10000, category: 'makanan',
      desc: 'Pentol lembut dengan kuah taican merah menyala, hangat & nendang.', palette: ['#C1121F', '#FB8500'] },
    { id: 'pentol-original', name: 'Baso Pentol Kuah Original', price: 10000, category: 'makanan',
      desc: 'Pentol lembut dengan kuah kaldu original yang ringan dan gurih.', palette: ['#DDA15E', '#FEFAE0'] },
    { id: 'jelly-manggo',  name: 'Es Jelly Manggo',          price: 10000, category: 'minuman',
      desc: 'Es mangga segar dengan jelly kenyal — pas buat penutup kuah pedas.', palette: ['#FFB703', '#FB8500'], badge: 'Segar' },
  ],

  statuses: ['Baru', 'Dimasak', 'Diantar', 'Selesai'],
};
