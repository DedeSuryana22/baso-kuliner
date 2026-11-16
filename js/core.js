/* =========================================================
   BASO KULINER — LOGIKA INTI (tanpa DOM, bisa dites di Node)
   ========================================================= */
(function (root) {
  const rupiah = (n) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');

  // Jarak garis lurus (km) antar dua koordinat — rumus Haversine
  function haversineKm(a, b) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // Hitung ongkir dari jarak (km) sesuai aturan di config.shipping
  function calcShipping(distanceKm, rule) {
    const d = distanceKm * (rule.distanceFactor || 1);
    if (rule.maxRadiusKm && d > rule.maxRadiusKm) {
      return { distanceKm: d, fee: null, outOfRange: true, billedKm: 0 };
    }
    if (d <= rule.freeRadiusKm) return { distanceKm: d, fee: 0, outOfRange: false, billedKm: 0 };
    const billedKm = rule.mode === 'excess'
      ? Math.ceil(d - rule.freeRadiusKm)
      : Math.ceil(d);
    return { distanceKm: d, fee: billedKm * rule.ratePerKm, outOfRange: false, billedKm };
  }

  // 0812xxx / +62 812 / 62812 -> 62812xxx
  function normalizeWa(raw) {
    let n = String(raw || '').replace(/[^\d]/g, '');
    if (n.startsWith('0')) n = '62' + n.slice(1);
    else if (n.startsWith('8')) n = '62' + n;
    return n;
  }
  const isValidWa = (n) => /^628\d{7,12}$/.test(n);

  function pad(n) { return String(n).padStart(2, '0'); }
  function localDateKey(d) {
    d = new Date(d);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function makeOrderId(prefix, date) {
    const d = date ? new Date(date) : new Date();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${prefix}-${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${rand}`;
  }
  function fmtDateTime(iso) {
    const d = new Date(iso);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

  // Format pesan WhatsApp (format ini juga dibaca balik oleh parseWaMessage)
  function buildWaMessage(order, brandName) {
    const L = [];
    L.push(`*PESANAN BARU — ${brandName.toUpperCase()}*`);
    L.push(`Kode: ${order.id}`);
    L.push(`Waktu: ${fmtDateTime(order.createdAt)}`);
    L.push('');
    L.push('*Rincian Menu:*');
    order.items.forEach((it, i) => {
      L.push(`${i + 1}. ${it.name} x${it.qty} = ${rupiah(it.price * it.qty)}`);
      if (it.note) L.push(`   Catatan: ${it.note}`);
    });
    L.push('');
    L.push(`Subtotal: ${rupiah(order.subtotal)}`);
    L.push(`Ongkir: ${order.shippingFee === 0 ? 'GRATIS' : rupiah(order.shippingFee)} (${order.distanceKm.toFixed(2)} km)`);
    L.push(`*TOTAL: ${rupiah(order.total)}*`);
    L.push(`Metode Bayar: ${order.payment}`);
    L.push('');
    L.push('*Data Pemesan:*');
    L.push(`Nama: ${order.customer.name}`);
    L.push(`No. WA: ${order.customer.wa}`);
    L.push(`Patokan: ${order.customer.address}`);
    L.push(`Lokasi: ${mapsLink(order.location.lat, order.location.lng)}`);
    L.push('');
    L.push('Mohon dikonfirmasi ya, terima kasih 🙏');
    return L.join('\n');
  }

  const waLink = (number, text) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

  // Baca balik pesan WA (untuk impor di kasir). Mengembalikan null jika bukan format pesanan.
  function parseRupiah(s) { return parseInt(String(s).replace(/[^\d]/g, ''), 10) || 0; }
  function parseWaMessage(text, menu) {
    if (!text) return null;
    const t = text.replace(/\r/g, '').replace(/\*/g, '');
    const get = (re) => { const m = t.match(re); return m ? m[1].trim() : ''; };
    const id = get(/Kode:\s*(\S+)/);
    if (!id) return null;
    const items = [];
    const lines = t.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\s*\d+\.\s+(.+?)\s+x(\d+)\s*=\s*(Rp[\s\d.]+)/);
      if (m) {
        const qty = parseInt(m[2], 10);
        const lineTotal = parseRupiah(m[3]);
        const found = menu.find((x) => x.name.toLowerCase() === m[1].toLowerCase());
        const item = { menuId: found ? found.id : null, name: m[1], qty, price: Math.round(lineTotal / qty), note: '' };
        const next = lines[i + 1] || '';
        const n = next.match(/^\s*Catatan:\s*(.+)$/);
        if (n) item.note = n[1].trim();
        items.push(item);
      }
    }
    if (!items.length) return null;
    const loc = t.match(/maps\?q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    const ongkirRaw = get(/Ongkir:\s*([^(\n]+)/);
    const subtotal = parseRupiah(get(/Subtotal:\s*(.+)/));
    const shippingFee = /GRATIS/i.test(ongkirRaw) ? 0 : parseRupiah(ongkirRaw);
    const dist = parseFloat((get(/Ongkir:[^(]*\(([\d.,]+)\s*km/) || '0').replace(',', '.'));
    const wm = get(/Waktu:\s*(.+)/).match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
    const createdAt = wm ? new Date(+wm[3], +wm[2] - 1, +wm[1], +wm[4], +wm[5]).toISOString() : new Date().toISOString();
    return {
      id, channel: 'online', type: 'Delivery', createdAt, status: 'Baru',
      items, subtotal: subtotal || items.reduce((s, x) => s + x.price * x.qty, 0),
      shippingFee, distanceKm: dist || 0,
      total: parseRupiah(get(/TOTAL:\s*(.+)/)) || subtotal + shippingFee,
      payment: get(/Metode Bayar:\s*(.+)/) || 'COD',
      customer: { name: get(/Nama:\s*(.+)/), wa: get(/No\. WA:\s*(.+)/), address: get(/Patokan:\s*(.+)/) },
      location: loc ? { lat: parseFloat(loc[1]), lng: parseFloat(loc[2]) } : null,
      imported: true,
    };
  }

  // Ringkasan laporan untuk satu tanggal (YYYY-MM-DD lokal)
  function buildReport(orders, dateKey) {
    const list = orders.filter((o) => localDateKey(o.createdAt) === dateKey);
    const r = { count: list.length, subtotal: 0, shipping: 0, total: 0, online: 0, pos: 0, porsi: 0, perItem: {}, perPay: {} };
    list.forEach((o) => {
      r.subtotal += o.subtotal; r.shipping += o.shippingFee || 0; r.total += o.total;
      r[o.channel === 'pos' ? 'pos' : 'online'] += o.total;
      r.perPay[o.payment] = (r.perPay[o.payment] || 0) + o.total;
      o.items.forEach((it) => {
        const k = it.name;
        r.perItem[k] = r.perItem[k] || { qty: 0, omzet: 0 };
        r.perItem[k].qty += it.qty; r.perItem[k].omzet += it.qty * it.price;
        r.porsi += it.qty;
      });
    });
    r.orders = list;
    return r;
  }

  // Baris detail untuk export (satu baris per item)
  function exportRows(orders) {
    const head = ['Kode', 'Tanggal', 'Jam', 'Channel', 'Tipe', 'Status', 'Nama', 'No WA', 'Menu', 'Qty', 'Harga', 'Subtotal Item', 'Catatan', 'Ongkir', 'Total Order', 'Metode Bayar', 'Jarak (km)', 'Google Maps'];
    const rows = [head];
    orders.forEach((o) => {
      const d = new Date(o.createdAt);
      o.items.forEach((it, idx) => {
        rows.push([
          o.id, localDateKey(d), `${pad(d.getHours())}:${pad(d.getMinutes())}`,
          o.channel === 'pos' ? 'Kasir' : 'Online', o.type, o.status,
          (o.customer && o.customer.name) || '', (o.customer && o.customer.wa) || '',
          it.name, it.qty, it.price, it.qty * it.price, it.note || '',
          idx === 0 ? (o.shippingFee || 0) : 0, idx === 0 ? o.total : 0, o.payment,
          o.distanceKm ? o.distanceKm.toFixed(2) : '', o.location ? mapsLink(o.location.lat, o.location.lng) : '',
        ]);
      });
    });
    return rows;
  }
  function toCsv(rows) {
    const esc = (v) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
  }
  function toXlsHtml(rows, title) {
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const body = rows.map((r, i) => '<tr>' + r.map((c) => i === 0 ? `<th>${esc(c)}</th>` : `<td>${esc(c)}</td>`).join('') + '</tr>').join('');
    return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><title>${esc(title)}</title></head><body><table border="1">${body}</table></body></html>`;
  }

  const api = { rupiah, haversineKm, calcShipping, normalizeWa, isValidWa, localDateKey, makeOrderId, fmtDateTime, mapsLink, buildWaMessage, waLink, parseWaMessage, buildReport, exportRows, toCsv, toXlsHtml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BK = api;
})(typeof window !== 'undefined' ? window : globalThis);
