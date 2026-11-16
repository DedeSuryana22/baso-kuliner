// Jalankan: node tests/core.test.js
const assert = require('assert');
const BK = require('../js/core.js');
global.window = {}; require('../js/config.js'); const C = global.window.BK_CONFIG;
let pass = 0; const t = (name, fn) => { fn(); pass++; console.log('✓', name); };

t('Haversine: Monas -> Bundaran HI ≈ 2,3 km', () => {
  const d = BK.haversineKm({ lat: -6.175392, lng: 106.827153 }, { lat: -6.194927, lng: 106.823038 });
  assert(d > 2.1 && d < 2.4, d);
});
t('Haversine: titik sama = 0', () => assert.strictEqual(BK.haversineKm(C.origin, C.origin), 0));

const rule = { freeRadiusKm: 2, ratePerKm: 2500, mode: 'full', maxRadiusKm: 10, distanceFactor: 1 };
t('Ongkir 1,5 km = gratis', () => assert.strictEqual(BK.calcShipping(1.5, rule).fee, 0));
t('Ongkir tepat 2 km = gratis', () => assert.strictEqual(BK.calcShipping(2, rule).fee, 0));
t('Ongkir 2,3 km (full) = 3 x 2.500 = 7.500', () => assert.strictEqual(BK.calcShipping(2.3, rule).fee, 7500));
t('Ongkir 4,0 km (full) = 10.000', () => assert.strictEqual(BK.calcShipping(4, rule).fee, 10000));
t('Ongkir 2,3 km (excess) = 2.500', () => assert.strictEqual(BK.calcShipping(2.3, { ...rule, mode: 'excess' }).fee, 2500));
t('Di luar radius 10 km ditolak', () => assert(BK.calcShipping(10.5, rule).outOfRange));

t('Normalisasi WA', () => {
  assert.strictEqual(BK.normalizeWa('0812-3456-7890'), '6281234567890');
  assert.strictEqual(BK.normalizeWa('+62 812 3456 7890'), '6281234567890');
  assert(BK.isValidWa(BK.normalizeWa('081234567890')));
  assert(!BK.isValidWa(BK.normalizeWa('12345')));
});

const order = {
  id: 'BK-261116-AB12', createdAt: new Date(2026, 10, 16, 12, 5).toISOString(), channel: 'online', status: 'Baru',
  items: [{ menuId: 'aci-ambyar', name: 'Baso Aci Ambyar', price: 10000, qty: 2, note: 'Pedas banget, Tanpa seledri' },
          { menuId: 'jelly-manggo', name: 'Es Jelly Manggo', price: 10000, qty: 1, note: '' }],
  subtotal: 30000, shippingFee: 7500, distanceKm: 2.31, total: 37500, payment: 'QRIS',
  customer: { name: 'Dede', wa: '081234567890', address: 'Blok C3 no 12' }, location: { lat: -6.201234, lng: 107.061234 },
};
const msg = BK.buildWaMessage(order, 'Baso Kuliner');
t('Pesan WA memuat link Google Maps yang benar', () => assert(msg.includes('https://www.google.com/maps?q=-6.201234,107.061234')));
t('Pesan WA memuat rincian, catatan, ongkir, total, metode', () => {
  ['Baso Aci Ambyar x2 = Rp 20.000', 'Catatan: Pedas banget, Tanpa seledri', 'Ongkir: Rp 7.500 (2.31 km)', 'TOTAL: Rp 37.500', 'Metode Bayar: QRIS'].forEach((s) => assert(msg.includes(s), s));
});
t('Link wa.me ter-encode', () => {
  const u = BK.waLink('62895410651146', msg);
  assert(u.startsWith('https://wa.me/62895410651146?text='));
  assert.strictEqual(decodeURIComponent(u.split('text=')[1]), msg);
});
t('Impor balik pesan WA (round-trip)', () => {
  const p = BK.parseWaMessage(msg, C.menu);
  assert.strictEqual(p.id, order.id);
  assert.strictEqual(p.items.length, 2);
  assert.strictEqual(p.items[0].note, 'Pedas banget, Tanpa seledri');
  assert.strictEqual(p.items[0].menuId, 'aci-ambyar');
  assert.strictEqual(p.total, 37500); assert.strictEqual(p.shippingFee, 7500); assert.strictEqual(p.payment, 'QRIS');
  assert.deepStrictEqual(p.location, order.location);
  assert.strictEqual(BK.localDateKey(p.createdAt), '2026-11-16');
});
t('Impor pesan ongkir GRATIS', () => {
  const m = BK.buildWaMessage({ ...order, shippingFee: 0, total: 30000, distanceKm: 1.2 }, 'Baso Kuliner');
  const p = BK.parseWaMessage(m, C.menu); assert.strictEqual(p.shippingFee, 0); assert.strictEqual(p.total, 30000);
});
t('Laporan harian', () => {
  const pos = { ...order, id: 'POS-1', channel: 'pos', shippingFee: 0, total: 30000, payment: 'Tunai' };
  const r = BK.buildReport([order, pos], '2026-11-16');
  assert.strictEqual(r.total, 67500); assert.strictEqual(r.shipping, 7500); assert.strictEqual(r.porsi, 6);
  assert.strictEqual(r.perItem['Baso Aci Ambyar'].qty, 4); assert.strictEqual(r.pos, 30000); assert.strictEqual(r.online, 37500);
});
t('Export CSV', () => {
  const csv = BK.toCsv(BK.exportRows([order]));
  assert(csv.startsWith('﻿Kode,')); assert(csv.includes('"Pedas banget, Tanpa seledri"'));
});
console.log(`\n${pass} tes lulus`);
