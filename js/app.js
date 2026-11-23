/* =========================================================
   BASO KULINER — UI & STATE
   ========================================================= */
(function () {
  const C = window.BK_CONFIG;
  const { rupiah } = BK;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  /* ---------- Storage ---------- */
  const KEY = { orders: 'bk_orders', cart: 'bk_cart', cust: 'bk_customer', loc: 'bk_location' };
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Penyimpanan browser penuh/diblokir'); } };

  const state = {
    cart: load(KEY.cart, []),        // [{key, menuId, name, price, qty, note}]
    location: load(KEY.loc, null),   // {lat,lng}
    category: 'all',
    sheet: null,                     // {item, qty, notes:Set}
    pos: { cart: [], type: 'Makan di Tempat', pay: 'Tunai' },
    statusFilter: 'Semua',
  };
  const getOrders = () => load(KEY.orders, []);
  const setOrders = (o) => save(KEY.orders, o);

  /* ---------- Mode server (Python + SQLite + Ollama) ----------
     Jika aplikasi dibuka dari baso_kuliner.py, pesanan disimpan juga ke server
     sehingga semua perangkat melihat data yang sama. Di GitHub Pages /api tidak
     ada, jadi aplikasi otomatis kembali ke mode localStorage seperti biasa. */
  const SERVER = { on: false, ai: false, model: '', modelInstalled: false };
  const MY = 'bk_my_orders';
  const myIds = () => load(MY, null) ?? (() => { const ids = getOrders().filter((o) => o.channel === 'online' && !o.imported).map((o) => o.id); save(MY, ids); return ids; })();
  const addMyId = (id) => { const ids = myIds(); ids.unshift(id); save(MY, ids.slice(0, 200)); };
  async function api(path, opts = {}) {
    const res = await fetch('api/' + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  }
  async function detectServer() {
    try {
      const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 2500);
      const h = await api('health', { signal: ctrl.signal });
      SERVER.on = !!h.server;
      SERVER.ai = !!(h.ollama && h.ollama.running);
      SERVER.model = (h.ollama && h.ollama.model) || '';
      SERVER.modelInstalled = !!(h.ollama && h.ollama.modelInstalled);
    } catch (e) { SERVER.on = false; SERVER.ai = false; }
    applyServerUi();
  }
  const pushOrder = (o) => { if (SERVER.on) api('orders', { method: 'POST', body: JSON.stringify(o), keepalive: true }).catch(() => {}); };
  let lastSig = '';
  async function syncOrders() {
    if (!SERVER.on) return false;
    try {
      const { orders: remote } = await api('orders');
      const ids = new Set(remote.map((o) => o.id));
      const localOnly = getOrders().filter((o) => !ids.has(o.id));
      await Promise.all(localOnly.map((o) => api('orders', { method: 'POST', body: JSON.stringify(o) }).catch(() => {})));
      const merged = [...remote, ...localOnly].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const sig = merged.map((o) => o.id + o.status).join('|');
      const changed = sig !== lastSig, firstSync = !lastSig;
      const prevIds = new Set(getOrders().map((o) => o.id));
      setOrders(merged); lastSig = sig;
      const incoming = merged.filter((o) => !prevIds.has(o.id) && o.status === 'Baru');
      if (!firstSync && incoming.length) { toast(`🔔 ${incoming.length} pesanan baru masuk!`); beep(); }
      return changed;
    } catch (e) { return false; }
  }
  function beep() {
    try { const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(); o.frequency.value = 880; o.connect(a.destination); o.start(); setTimeout(() => { o.stop(); a.close(); }, 250); } catch (e) {}
  }

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Ilustrasi menu (SVG, tanpa file foto) ---------- */
  function foodArt(item) {
    const [a, b] = item.palette;
    const id = item.id;
    if (item.category === 'minuman') {
      return `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(item.name)}">
        <defs><linearGradient id="g-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF4E0"/><stop offset="1" stop-color="#FFE0B8"/></linearGradient>
        <linearGradient id="d-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
        <rect width="200" height="150" fill="url(#g-${id})"/>
        <circle cx="160" cy="28" r="34" fill="${a}" opacity=".15"/>
        <path d="M70 35 h60 l-8 95 a8 8 0 0 1-8 7 h-28 a8 8 0 0 1-8-7z" fill="#fff" opacity=".7"/>
        <path d="M74 60 h52 l-5.5 68 a6 6 0 0 1-6 5 h-29 a6 6 0 0 1-6-5z" fill="url(#d-${id})"/>
        <rect x="84" y="78" width="12" height="12" rx="3" fill="#fff" opacity=".55" transform="rotate(12 90 84)"/>
        <rect x="103" y="95" width="12" height="12" rx="3" fill="#fff" opacity=".45" transform="rotate(-10 109 101)"/>
        <rect x="88" y="108" width="11" height="11" rx="3" fill="#E9F5DB" opacity=".7"/>
        <circle cx="112" cy="72" r="5" fill="#fff" opacity=".5"/>
        <rect x="108" y="18" width="5" height="60" rx="2.5" fill="${a}" transform="rotate(14 110 48)"/>
      </svg>`;
    }
    return `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(item.name)}">
      <defs><linearGradient id="g-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF4E8"/><stop offset="1" stop-color="#FFDCC2"/></linearGradient>
      <radialGradient id="k-${id}" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></radialGradient></defs>
      <rect width="200" height="150" fill="url(#g-${id})"/>
      <circle cx="30" cy="25" r="30" fill="${a}" opacity=".12"/>
      <path d="M85 30 q-8 -10 0 -20 M100 32 q-8 -12 0 -24 M115 30 q-8 -10 0 -20" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".9"/>
      <ellipse cx="100" cy="78" rx="72" ry="20" fill="url(#k-${id})"/>
      <circle cx="78" cy="74" r="13" fill="#8B5E3C"/><circle cx="74" cy="70" r="4" fill="#fff" opacity=".25"/>
      <circle cx="104" cy="70" r="15" fill="#7A4E2D"/><circle cx="99" cy="65" r="4.5" fill="#fff" opacity=".25"/>
      <circle cx="128" cy="76" r="12" fill="#8B5E3C"/><circle cx="124" cy="72" r="3.5" fill="#fff" opacity=".25"/>
      <path d="M60 80 q10 -6 20 0 t20 0" stroke="#F1E3B5" stroke-width="3" fill="none"/>
      <circle cx="92" cy="84" r="2.5" fill="#2D6A4F"/><circle cx="116" cy="86" r="2.5" fill="#2D6A4F"/><circle cx="140" cy="80" r="2" fill="#2D6A4F"/>
      <path d="M28 80 q72 75 144 0 z" fill="#fff"/>
      <path d="M28 80 q72 75 144 0" stroke="${a}" stroke-width="4" fill="none"/>
      <path d="M50 100 q50 30 100 0" stroke="${a}" stroke-width="2" fill="none" opacity=".35" stroke-dasharray="4 6"/>
      <rect x="140" y="20" width="4" height="70" rx="2" fill="#C68B59" transform="rotate(28 142 55)"/>
      <rect x="150" y="20" width="4" height="70" rx="2" fill="#B07A4A" transform="rotate(32 152 55)"/>
    </svg>`;
  }

  /* ---------- Navigasi ---------- */
  let currentView = 'menu';
  function go(view) {
    if (view === 'checkout' && !state.cart.length) { toast('Keranjang masih kosong'); return; }
    currentView = view;
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
    $$('#bottomNav button').forEach((b) => b.classList.toggle('active', b.dataset.go === view));
    $('#bottomNav').classList.toggle('hidden', view === 'checkout');
    window.scrollTo(0, 0);
    if (view === 'checkout') renderCheckout();
    if (view === 'history') renderHistory();
    if (view === 'kasir') renderKasir();
    renderCartBar();
  }
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]');
    if (g) { e.preventDefault(); go(g.dataset.go); }
  });

  /* ---------- Menu ---------- */
  function renderBrand() {
    $('#brandName').textContent = C.brand.name;
    $('#tagline').textContent = C.brand.tagline;
    $('#brandAddr').textContent = C.brand.address;
    $('#freeKm').textContent = C.shipping.freeRadiusKm;
    const ig = $('#igLink'); ig.textContent = '@' + C.brand.instagram; ig.href = 'https://instagram.com/' + C.brand.instagram;
  }
  function renderMenu() {
    const list = C.menu.filter((m) => state.category === 'all' || m.category === state.category);
    $('#menuList').innerHTML = list.map((m) => {
      const inCart = state.cart.filter((c) => c.menuId === m.id).reduce((s, c) => s + c.qty, 0);
      return `<article class="menu-card" data-id="${m.id}">
        <div class="menu-img">${foodArt(m)}${m.badge ? `<span class="tag">${esc(m.badge)}</span>` : ''}</div>
        <div class="menu-info">
          <h3>${esc(m.name)}</h3>
          <p>${esc(m.desc)}</p>
          <div class="menu-foot">
            <b>${rupiah(m.price)}</b>
            <button class="btn btn-add" data-add="${m.id}">${inCart ? `✓ ${inCart} · Tambah` : '+ Tambah'}</button>
          </div>
        </div>
      </article>`;
    }).join('');
  }
  $('#categoryChips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    state.category = b.dataset.cat;
    $$('#categoryChips .chip').forEach((c) => c.classList.toggle('active', c === b));
    renderMenu();
  });
  $('#menuList').addEventListener('click', (e) => {
    const card = e.target.closest('[data-add]') || e.target.closest('.menu-card');
    if (!card) return;
    openSheet(card.dataset.add || card.dataset.id);
  });

  /* ---------- Sheet tambah item ---------- */
  function openSheet(id) {
    const item = C.menu.find((m) => m.id === id);
    state.sheet = { item, qty: 1, notes: new Set() };
    $('#sheetImg').innerHTML = foodArt(item);
    $('#sheetName').textContent = item.name;
    $('#sheetDesc').textContent = item.desc;
    $('#sheetPrice').textContent = rupiah(item.price);
    $('#sheetNoteText').value = '';
    const opts = C.noteOptions[item.category] || [];
    $('#sheetNotes').innerHTML = opts.map((o) => `<button class="chip" data-note="${esc(o)}">${esc(o)}</button>`).join('');
    updateSheet();
    $('#itemSheet').classList.remove('hidden');
  }
  function updateSheet() {
    const s = state.sheet;
    $('#sheetQty').textContent = s.qty;
    $('#sheetSubtotal').textContent = rupiah(s.item.price * s.qty);
  }
  function closeSheet() { $('#itemSheet').classList.add('hidden'); state.sheet = null; }
  $('#sheetNotes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-note]'); if (!b) return;
    const n = b.dataset.note, set = state.sheet.notes;
    // Level pedas saling eksklusif
    const spicy = ['Tidak pedas', 'Pedas sedang', 'Pedas banget'];
    if (spicy.includes(n)) spicy.forEach((x) => x !== n && set.delete(x));
    set.has(n) ? set.delete(n) : set.add(n);
    $$('#sheetNotes .chip').forEach((c) => c.classList.toggle('active', set.has(c.dataset.note)));
  });
  $('#sheetMinus').onclick = () => { if (state.sheet.qty > 1) { state.sheet.qty--; updateSheet(); } };
  $('#sheetPlus').onclick = () => { state.sheet.qty++; updateSheet(); };
  $('#sheetClose').onclick = closeSheet;
  $('#itemSheet').addEventListener('click', (e) => { if (e.target.id === 'itemSheet') closeSheet(); });
  $('#sheetAdd').onclick = () => {
    const s = state.sheet;
    const free = $('#sheetNoteText').value.trim();
    const note = [...s.notes, free].filter(Boolean).join(', ');
    addToCart(s.item, s.qty, note);
    closeSheet();
    toast(`${s.item.name} ditambahkan`);
  };

  /* ---------- Keranjang ---------- */
  function addToCart(item, qty, note) {
    const key = item.id + '|' + note;
    const ex = state.cart.find((c) => c.key === key);
    if (ex) ex.qty += qty;
    else state.cart.push({ key, menuId: item.id, name: item.name, price: item.price, qty, note });
    persistCart();
  }
  function persistCart() { save(KEY.cart, state.cart); renderCartBar(); renderMenu(); }
  const cartSubtotal = () => state.cart.reduce((s, c) => s + c.price * c.qty, 0);
  const cartQty = () => state.cart.reduce((s, c) => s + c.qty, 0);
  function renderCartBar() {
    const show = state.cart.length && currentView === 'menu';
    $('#cartBar').classList.toggle('hidden', !show);
    $('#aiFab').classList.toggle('hidden', !(SERVER.ai && currentView === 'menu'));
    $('#aiFab').classList.toggle('low', !show);
    $('#cartCount').textContent = cartQty();
    $('#cartTotal').textContent = rupiah(cartSubtotal());
  }
  function renderCartItems() {
    $('#cartItems').innerHTML = state.cart.map((c, i) => `
      <div class="cart-item">
        <div><b>${esc(c.name)}</b>${c.note ? `<small>📝 ${esc(c.note)}</small>` : ''}<span class="muted">${rupiah(c.price)}</span></div>
        <div class="qty sm"><button data-dec="${i}">−</button><span>${c.qty}</span><button data-inc="${i}">+</button></div>
      </div>`).join('') || '<p class="hint">Keranjang kosong</p>';
  }
  $('#cartItems').addEventListener('click', (e) => {
    const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]');
    if (inc) state.cart[+inc.dataset.inc].qty++;
    if (dec) { const i = +dec.dataset.dec; state.cart[i].qty--; if (state.cart[i].qty <= 0) state.cart.splice(i, 1); }
    if (inc || dec) {
      persistCart();
      if (!state.cart.length) { go('menu'); return; }
      renderCartItems(); renderSummary();
    }
  });

  /* ---------- Peta (Leaflet + OSM) ---------- */
  let map, custMarker, line;
  function initMap() {
    if (map) { setTimeout(() => map.invalidateSize(), 50); return; }
    const o = C.origin;
    map = L.map('map', { zoomControl: true }).setView([o.lat, o.lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    const shopIcon = L.divIcon({ className: 'pin-shop', html: '🍜', iconSize: [36, 36], iconAnchor: [18, 18] });
    L.marker([o.lat, o.lng], { icon: shopIcon }).addTo(map).bindPopup(`<b>${esc(C.brand.name)}</b><br>${esc(C.brand.address)}`);
    L.circle([o.lat, o.lng], { radius: C.shipping.freeRadiusKm * 1000, color: '#2A9D8F', weight: 1, fillOpacity: 0.07, dashArray: '4 6' }).addTo(map);

    const custIcon = L.divIcon({ className: 'pin-cust', html: '<div class="pin-drop"></div>', iconSize: [30, 42], iconAnchor: [15, 40] });
    const start = state.location || { lat: o.lat + 0.004, lng: o.lng + 0.004 };
    custMarker = L.marker([start.lat, start.lng], { draggable: true, icon: custIcon, autoPan: true }).addTo(map);
    custMarker.on('dragend', () => setLocation(custMarker.getLatLng()));
    map.on('click', (e) => setLocation(e.latlng));
    line = L.polyline([[o.lat, o.lng], [start.lat, start.lng]], { color: '#D62828', weight: 2, dashArray: '6 6' }).addTo(map);
    if (state.location) map.fitBounds(line.getBounds(), { padding: [40, 40] });
    setTimeout(() => map.invalidateSize(), 80);
  }
  function setLocation(latlng, fit) {
    state.location = { lat: +latlng.lat, lng: +latlng.lng };
    save(KEY.loc, state.location);
    if (custMarker) {
      custMarker.setLatLng(latlng);
      line.setLatLngs([[C.origin.lat, C.origin.lng], [latlng.lat, latlng.lng]]);
      if (fit) map.fitBounds(line.getBounds(), { padding: [40, 40], maxZoom: 16 });
    }
    renderSummary();
  }
  $('#btnGps').onclick = () => {
    if (!navigator.geolocation) return toast('Browser tidak mendukung GPS');
    const btn = $('#btnGps'); btn.disabled = true; btn.textContent = '📡 Mencari lokasi...';
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocation({ lat: p.coords.latitude, lng: p.coords.longitude }, true); btn.disabled = false; btn.textContent = '📡 Gunakan Lokasi Saya (GPS)'; toast(`Lokasi ditemukan (akurasi ±${Math.round(p.coords.accuracy)} m). Geser pin jika kurang tepat.`); },
      (err) => { btn.disabled = false; btn.textContent = '📡 Gunakan Lokasi Saya (GPS)'; toast(err.code === 1 ? 'Izin lokasi ditolak — geser pin manual ya' : 'Gagal ambil lokasi, coba geser pin manual'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  function shippingNow() {
    if (!state.location) return null;
    const km = BK.haversineKm(C.origin, state.location);
    return BK.calcShipping(km, C.shipping);
  }

  /* ---------- Checkout ---------- */
  function renderCheckout() {
    renderCartItems();
    const cust = load(KEY.cust, {});
    if (cust.name && !$('#custName').value) $('#custName').value = cust.name;
    if (cust.wa && !$('#custWa').value) $('#custWa').value = cust.wa;
    if (cust.address && !$('#custAddr').value) $('#custAddr').value = cust.address;
    initMap();
    renderSummary();
  }
  function renderSummary() {
    const sub = cartSubtotal();
    const sh = shippingNow();
    $('#sumSubtotal').textContent = rupiah(sub);
    const info = $('#distanceInfo');
    if (!sh) {
      info.className = 'distance-info'; info.textContent = 'Geser pin / ketuk peta / pakai GPS untuk menentukan titik antar';
      $('#sumOngkir').textContent = '-'; $('#sumDist').textContent = ''; $('#sumTotal').textContent = rupiah(sub);
      return;
    }
    $('#sumDist').textContent = `(${sh.distanceKm.toFixed(2)} km)`;
    if (sh.outOfRange) {
      info.className = 'distance-info bad';
      info.innerHTML = `📏 ${sh.distanceKm.toFixed(2)} km — di luar jangkauan antar (maks ${C.shipping.maxRadiusKm} km)`;
      $('#sumOngkir').textContent = 'Di luar area'; $('#sumTotal').textContent = rupiah(sub);
      return;
    }
    const free = sh.fee === 0;
    info.className = 'distance-info ' + (free ? 'good' : '');
    info.innerHTML = `📏 Jarak <b>${sh.distanceKm.toFixed(2)} km</b> — ` + (free ? '<b>GRATIS ONGKIR</b> 🎉' : `ongkir <b>${rupiah(sh.fee)}</b> (${sh.billedKm} km × ${rupiah(C.shipping.ratePerKm)})`);
    $('#sumOngkir').textContent = free ? 'GRATIS' : rupiah(sh.fee);
    $('#sumTotal').textContent = rupiah(sub + sh.fee);
  }

  /* ---------- Pembayaran ---------- */
  const selectedPay = () => ($('input[name="pay"]:checked') || {}).value || 'COD';
  function payHtml(method, total) {
    const P = C.payment;
    if (method === 'QRIS') return `<h3>Bayar dengan QRIS</h3>
      <img src="${P.qrisImage}" alt="Kode QRIS" class="qris-img" />
      <p class="center"><b>${esc(P.qrisMerchant)}</b></p>
      ${total ? `<p class="center big-amount">${rupiah(total)}</p>` : ''}
      <p class="hint center">Scan dengan m-banking / e-wallet apa saja, lalu kirim bukti bayar di chat WhatsApp.</p>`;
    if (method === 'Transfer SeaBank') return `<h3>Transfer SeaBank</h3>
      <div class="bank-box"><small>${esc(P.seabank.bank)}</small>
        <div class="acc" id="accNum">${esc(P.seabank.number)}</div>
        <small>a.n. ${esc(P.seabank.holder)}</small></div>
      <button class="btn btn-outline full" id="btnCopyAcc">📋 Salin No. Rekening</button>
      ${total ? `<p class="center big-amount">${rupiah(total)}</p>` : ''}
      <p class="hint center">Kirim bukti transfer di chat WhatsApp setelah pesanan dikirim.</p>`;
    return '';
  }
  function showPayModal(total) {
    const m = selectedPay(); if (m === 'COD') return;
    $('#payContent').innerHTML = payHtml(m, total);
    $('#payModal').classList.remove('hidden');
    const cp = $('#btnCopyAcc');
    if (cp) cp.onclick = () => {
      const n = C.payment.seabank.number.replace(/\s/g, '');
      (navigator.clipboard ? navigator.clipboard.writeText(n) : Promise.reject()).then(() => toast('No. rekening disalin'), () => toast(n));
    };
  }
  $('#payOptions').addEventListener('change', () => {
    const m = selectedPay();
    $('#btnShowPay').classList.toggle('hidden', m === 'COD');
    if (m !== 'COD') { const sh = shippingNow(); showPayModal(cartSubtotal() + (sh && sh.fee ? sh.fee : 0)); }
  });
  $('#btnShowPay').onclick = () => { const sh = shippingNow(); showPayModal(cartSubtotal() + (sh && sh.fee ? sh.fee : 0)); };
  $('#payClose').onclick = () => $('#payModal').classList.add('hidden');
  $('#payModal').addEventListener('click', (e) => { if (e.target.id === 'payModal') $('#payModal').classList.add('hidden'); });

  /* ---------- Pesan Sekarang ---------- */
  $('#btnOrder').onclick = () => {
    if (!state.cart.length) return toast('Keranjang kosong');
    const name = $('#custName').value.trim();
    const wa = BK.normalizeWa($('#custWa').value);
    const address = $('#custAddr').value.trim();
    if (!state.location) return toast('Tentukan titik antar di peta dulu ya');
    const sh = shippingNow();
    if (sh.outOfRange) return toast(`Maaf, di luar jangkauan antar (maks ${C.shipping.maxRadiusKm} km)`);
    if (!name) return focusErr('#custName', 'Nama wajib diisi');
    if (!BK.isValidWa(wa)) return focusErr('#custWa', 'No. WhatsApp tidak valid');
    if (!address) return focusErr('#custAddr', 'Patokan alamat wajib diisi');

    const subtotal = cartSubtotal();
    const order = {
      id: BK.makeOrderId('BK'), channel: 'online', type: 'Delivery',
      createdAt: new Date().toISOString(), status: 'Baru',
      items: state.cart.map(({ menuId, name, price, qty, note }) => ({ menuId, name, price, qty, note })),
      subtotal, shippingFee: sh.fee, distanceKm: sh.distanceKm, total: subtotal + sh.fee,
      payment: selectedPay(), customer: { name, wa, address }, location: { ...state.location },
    };
    const msg = BK.buildWaMessage(order, C.brand.name);
    const orders = getOrders(); orders.unshift(order); setOrders(orders);
    addMyId(order.id); pushOrder(order);
    save(KEY.cust, { name, wa: $('#custWa').value.trim(), address });
    state.cart = []; persistCart();
    const url = BK.waLink(C.whatsappAdmin, msg);
    const w = window.open(url, '_blank');          // dipanggil langsung dari klik -> tidak diblokir
    if (!w) window.location.href = url;            // fallback jika popup diblokir
    go('history'); toast('Pesanan tersimpan. Tekan "Kirim" di WhatsApp ya!');
  };
  function focusErr(sel, msg) { const el = $(sel); el.classList.add('err'); el.focus(); toast(msg); setTimeout(() => el.classList.remove('err'), 2000); }

  /* ---------- Riwayat (customer) ---------- */
  function statusClass(s) { return 'st-' + String(s).toLowerCase(); }
  function renderHistory() {
    const mine = new Set(myIds());
    const list = getOrders().filter((o) => mine.has(o.id));
    $('#historyList').innerHTML = list.length ? list.map((o) => `
      <div class="card order">
        <div class="order-head"><b>${o.id}</b><span class="status ${statusClass(o.status)}">${o.status}</span></div>
        <small class="muted">${BK.fmtDateTime(o.createdAt)} · ${esc(o.payment)}</small>
        <ul>${o.items.map((i) => `<li>${esc(i.name)} x${i.qty}${i.note ? ` <small>(${esc(i.note)})</small>` : ''}</li>`).join('')}</ul>
        <div class="order-foot"><span>Ongkir ${o.shippingFee ? rupiah(o.shippingFee) : 'GRATIS'}</span><b>${rupiah(o.total)}</b></div>
        <div class="btn-row">
          <button class="btn btn-ghost sm" data-reorder="${o.id}">🔁 Pesan lagi</button>
          <a class="btn btn-outline sm" href="${BK.waLink(C.whatsappAdmin, BK.buildWaMessage(o, C.brand.name))}">💬 Kirim ulang WA</a>
        </div>
      </div>`).join('') : '<div class="empty">🧾<p>Belum ada pesanan</p><button class="btn btn-primary" data-go="menu">Lihat Menu</button></div>';
  }
  $('#historyList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-reorder]'); if (!b) return;
    const o = getOrders().find((x) => x.id === b.dataset.reorder);
    o.items.forEach((it) => { const m = C.menu.find((x) => x.id === it.menuId); if (m) addToCart(m, it.qty, it.note); });
    toast('Item dimasukkan ke keranjang'); go('checkout');
  });

  /* ================= KASIR ================= */
  const isUnlocked = () => sessionStorage.getItem('bk_kasir') === '1';
  function renderKasir() {
    $('#pinGate').classList.toggle('hidden', isUnlocked());
    $('#kasirApp').classList.toggle('hidden', !isUnlocked());
    if (isUnlocked()) {
      renderPos(); renderOrders(); renderReport(); applyServerUi();
      syncOrders().then((ch) => { if (ch) { renderOrders(); renderReport(); } });
    }
    else setTimeout(() => $('#pinInput').focus(), 100);
  }
  function tryPin() {
    if ($('#pinInput').value === C.kasirPin) { sessionStorage.setItem('bk_kasir', '1'); $('#pinInput').value = ''; $('#pinError').textContent = ''; renderKasir(); }
    else { $('#pinError').textContent = 'PIN salah'; $('#pinInput').value = ''; }
  }
  $('#btnPin').onclick = tryPin;
  $('#pinInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryPin(); });
  $('#btnLock').onclick = () => { sessionStorage.removeItem('bk_kasir'); renderKasir(); };
  $('#kasirTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ktab]'); if (!b) return;
    $$('#kasirTabs button').forEach((x) => x.classList.toggle('active', x === b));
    $$('.ktab').forEach((t) => t.classList.toggle('active', t.id === 'ktab-' + b.dataset.ktab));
    if (b.dataset.ktab === 'orders') renderOrders();
    if (b.dataset.ktab === 'report') renderReport();
  });

  /* ---------- POS ---------- */
  function renderPos() {
    $('#posMenu').innerHTML = C.menu.map((m) => {
      const q = state.pos.cart.find((c) => c.menuId === m.id);
      return `<button class="pos-item" data-pos="${m.id}">${q ? `<span class="pos-q">${q.qty}</span>` : ''}
        <span class="pos-name">${esc(m.name)}</span><b>${rupiah(m.price)}</b></button>`;
    }).join('');
    $('#posCart').innerHTML = state.pos.cart.map((c, i) => `
      <div class="cart-item"><div><b>${esc(c.name)}</b><span class="muted">${rupiah(c.price)} × ${c.qty} = ${rupiah(c.price * c.qty)}</span></div>
      <div class="qty sm"><button data-pdec="${i}">−</button><span>${c.qty}</span><button data-pinc="${i}">+</button></div></div>`).join('')
      || '<p class="hint">Ketuk menu di atas untuk menambah</p>';
    const total = posTotal();
    $('#posTotal').textContent = rupiah(total);
    const quick = [...new Set([total, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, 50000, 100000])].filter((v) => v >= total && v > 0).slice(0, 4);
    $('#quickCash').innerHTML = quick.map((v) => `<button class="chip" data-cash="${v}">${v === total ? 'Uang Pas' : rupiah(v)}</button>`).join('');
    $('#cashBox').classList.toggle('hidden', state.pos.pay !== 'Tunai');
    updateChange();
  }
  const posTotal = () => state.pos.cart.reduce((s, c) => s + c.price * c.qty, 0);
  function updateChange() {
    const row = $('#changeRow');
    if (state.pos.pay !== 'Tunai') { row.classList.add('hidden'); return; }
    row.classList.remove('hidden');
    const cash = +$('#posCash').value || 0, ch = cash - posTotal();
    $('#posChange').textContent = cash ? (ch >= 0 ? rupiah(ch) : 'Kurang ' + rupiah(-ch)) : '-';
    $('#posChange').className = ch < 0 && cash ? 'neg' : '';
  }
  $('#posMenu').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pos]'); if (!b) return;
    const m = C.menu.find((x) => x.id === b.dataset.pos);
    const ex = state.pos.cart.find((c) => c.menuId === m.id);
    ex ? ex.qty++ : state.pos.cart.push({ menuId: m.id, name: m.name, price: m.price, qty: 1, note: '' });
    renderPos();
  });
  $('#posCart').addEventListener('click', (e) => {
    const inc = e.target.closest('[data-pinc]'), dec = e.target.closest('[data-pdec]');
    if (inc) state.pos.cart[+inc.dataset.pinc].qty++;
    if (dec) { const i = +dec.dataset.pdec; if (--state.pos.cart[i].qty <= 0) state.pos.cart.splice(i, 1); }
    if (inc || dec) renderPos();
  });
  $('#posType').addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]'); if (!b) return;
    state.pos.type = b.dataset.type; $$('#posType button').forEach((x) => x.classList.toggle('active', x === b));
  });
  $('#posPay').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pay]'); if (!b) return;
    state.pos.pay = b.dataset.pay; $$('#posPay button').forEach((x) => x.classList.toggle('active', x === b));
    renderPos();
    if (state.pos.pay === 'QRIS' && posTotal()) { $('#payContent').innerHTML = payHtml('QRIS', posTotal()); $('#payModal').classList.remove('hidden'); }
  });
  $('#quickCash').addEventListener('click', (e) => { const b = e.target.closest('[data-cash]'); if (b) { $('#posCash').value = b.dataset.cash; updateChange(); } });
  $('#posCash').addEventListener('input', updateChange);
  $('#btnPosClear').onclick = () => { state.pos.cart = []; $('#posCash').value = ''; $('#posName').value = ''; renderPos(); };
  $('#btnPosSave').onclick = () => {
    const total = posTotal();
    if (!total) return toast('Belum ada item');
    const cash = +$('#posCash').value || 0;
    if (state.pos.pay === 'Tunai' && cash < total) return toast('Uang diterima kurang dari total');
    const order = {
      id: BK.makeOrderId('POS'), channel: 'pos', type: state.pos.type, createdAt: new Date().toISOString(), status: 'Selesai',
      items: state.pos.cart.map((c) => ({ ...c })), subtotal: total, shippingFee: 0, distanceKm: 0, total,
      payment: state.pos.pay, cashReceived: state.pos.pay === 'Tunai' ? cash : total, change: state.pos.pay === 'Tunai' ? cash - total : 0,
      customer: { name: $('#posName').value.trim(), wa: '', address: '' }, location: null,
    };
    const orders = getOrders(); orders.unshift(order); setOrders(orders); pushOrder(order);
    toast(`Tersimpan ${order.id}` + (order.change ? ` · Kembalian ${rupiah(order.change)}` : ''));
    $('#btnPosClear').click(); renderReport(); renderOrders();
  };

  /* ---------- Daftar pesanan ---------- */
  function renderOrders() {
    const all = getOrders();
    const filters = ['Semua', ...C.statuses];
    $('#statusFilter').innerHTML = filters.map((f) => {
      const n = f === 'Semua' ? all.length : all.filter((o) => o.status === f).length;
      return `<button class="chip ${state.statusFilter === f ? 'active' : ''}" data-sf="${f}">${f} (${n})</button>`;
    }).join('');
    const nNew = all.filter((o) => o.status === 'Baru').length;
    $('#newBadge').textContent = nNew; $('#newBadge').classList.toggle('hidden', !nNew);
    const list = all.filter((o) => state.statusFilter === 'Semua' || o.status === state.statusFilter);
    $('#orderList').innerHTML = list.length ? list.map((o) => `
      <div class="card order">
        <div class="order-head"><b>${o.id}</b><span class="status ${statusClass(o.status)}">${o.status}</span></div>
        <small class="muted">${BK.fmtDateTime(o.createdAt)} · ${o.channel === 'pos' ? '🧮 Kasir · ' + esc(o.type) : '🛵 Online'} · ${esc(o.payment)}</small>
        ${o.customer && o.customer.name ? `<div class="cust-line">👤 ${esc(o.customer.name)}${o.customer.wa ? ` · <a href="https://wa.me/${BK.normalizeWa(o.customer.wa)}" target="_blank" rel="noopener">${esc(o.customer.wa)}</a>` : ''}</div>` : ''}
        ${o.customer && o.customer.address ? `<div class="cust-line">📍 ${esc(o.customer.address)}</div>` : ''}
        <ul>${o.items.map((i) => `<li>${esc(i.name)} x${i.qty}${i.note ? ` <small>(${esc(i.note)})</small>` : ''}</li>`).join('')}</ul>
        <div class="order-foot"><span>${o.channel === 'online' ? `Ongkir ${o.shippingFee ? rupiah(o.shippingFee) : 'GRATIS'} · ${o.distanceKm.toFixed(2)} km` : (o.change ? `Kembalian ${rupiah(o.change)}` : '')}</span><b>${rupiah(o.total)}</b></div>
        <div class="status-row">${C.statuses.map((s) => `<button class="st-btn ${o.status === s ? 'active ' + statusClass(s) : ''}" data-oid="${o.id}" data-st="${s}">${s}</button>`).join('')}</div>
        <div class="btn-row">
          ${o.location ? `<a class="btn btn-outline sm" target="_blank" rel="noopener" href="${BK.mapsLink(o.location.lat, o.location.lng)}">🗺️ Buka Maps</a>` : ''}
          <button class="btn btn-ghost sm danger" data-del="${o.id}">Hapus</button>
        </div>
      </div>`).join('') : '<div class="empty">📭<p>Tidak ada pesanan</p></div>';
  }
  $('#statusFilter').addEventListener('click', (e) => { const b = e.target.closest('[data-sf]'); if (b) { state.statusFilter = b.dataset.sf; renderOrders(); } });
  $('#orderList').addEventListener('click', (e) => {
    const st = e.target.closest('[data-st]'), del = e.target.closest('[data-del]');
    const orders = getOrders();
    if (st) {
      const o = orders.find((x) => x.id === st.dataset.oid); o.status = st.dataset.st; o.updatedAt = new Date().toISOString(); setOrders(orders); renderOrders();
      if (SERVER.on) api('orders/' + encodeURIComponent(o.id), { method: 'PATCH', body: JSON.stringify({ status: o.status }) }).catch(() => toast('Gagal simpan status ke server'));
    }
    if (del && confirmDelete(del.dataset.del)) {
      const id = del.dataset.del;
      setOrders(orders.filter((x) => x.id !== id)); renderOrders(); renderReport(); toast('Pesanan dihapus');
      if (SERVER.on) api('orders/' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => toast('Gagal hapus di server'));
    }
  });
  // Konfirmasi hapus dengan tap dua kali (menghindari dialog browser)
  const pendingDel = {};
  function confirmDelete(id) {
    if (pendingDel[id]) { delete pendingDel[id]; return true; }
    pendingDel[id] = true; toast('Ketuk "Hapus" sekali lagi untuk konfirmasi'); setTimeout(() => delete pendingDel[id], 3000); return false;
  }
  $('#btnImport').onclick = () => {
    const o = BK.parseWaMessage($('#importText').value, C.menu);
    if (!o) return toast('Format pesan tidak dikenali');
    const orders = getOrders();
    if (orders.some((x) => x.id === o.id)) return toast(`Pesanan ${o.id} sudah ada`);
    orders.unshift(o); setOrders(orders); pushOrder(o); $('#importText').value = '';
    toast(`Pesanan ${o.id} diimpor`); renderOrders(); renderReport();
  };

  /* ---------- Laporan ---------- */
  function renderReport() {
    const di = $('#reportDate'); if (!di.value) di.value = BK.localDateKey(new Date());
    const r = BK.buildReport(getOrders(), di.value);
    state.lastReport = r;
    $('#reportStats').innerHTML = `
      <div class="stat main"><small>Omzet (termasuk ongkir)</small><b>${rupiah(r.total)}</b></div>
      <div class="stat"><small>Omzet makanan</small><b>${rupiah(r.subtotal)}</b></div>
      <div class="stat"><small>Ongkir</small><b>${rupiah(r.shipping)}</b></div>
      <div class="stat"><small>Transaksi</small><b>${r.count}</b></div>
      <div class="stat"><small>Porsi terjual</small><b>${r.porsi}</b></div>
      <div class="stat"><small>Online / Kasir</small><b>${rupiah(r.online)} / ${rupiah(r.pos)}</b></div>`;
    const items = Object.entries(r.perItem).sort((a, b) => b[1].qty - a[1].qty);
    const max = items.length ? items[0][1].qty : 1;
    $('#reportItems').innerHTML = items.length ? items.map(([n, v]) => `
      <div class="bar-row"><div class="bar-label"><span>${esc(n)}</span><b>${v.qty} porsi · ${rupiah(v.omzet)}</b></div>
      <div class="bar"><div style="width:${(v.qty / max) * 100}%"></div></div></div>`).join('') : '<p class="hint">Belum ada penjualan di tanggal ini</p>';
    $('#reportPay').innerHTML = Object.keys(r.perPay).length ? Object.entries(r.perPay).map(([k, v]) => `<div class="row"><span>${esc(k)}</span><b>${rupiah(v)}</b></div>`).join('') : '<p class="hint">-</p>';
  }
  $('#reportDate').addEventListener('change', renderReport);
  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportData(kind) {
    const d = $('#reportDate').value;
    const r = BK.buildReport(getOrders(), d);
    if (!r.orders.length) return toast('Tidak ada data di tanggal ini');
    const rows = BK.exportRows(r.orders);
    if (kind === 'csv') download(`baso-kuliner-${d}.csv`, BK.toCsv(rows), 'text/csv;charset=utf-8');
    else download(`baso-kuliner-${d}.xls`, BK.toXlsHtml(rows, 'Laporan ' + d), 'application/vnd.ms-excel');
  }
  $('#btnCsv').onclick = () => exportData('csv');
  $('#btnXls').onclick = () => exportData('xls');

  // Sinkron antar-tab di perangkat yang sama
  window.addEventListener('storage', (e) => { if (e.key === KEY.orders && currentView === 'kasir' && isUnlocked()) { renderOrders(); renderReport(); } });

  /* ================= ASISTEN AI (Ollama) ================= */
  const chat = [];   // {role, content}
  function applyServerUi() {
    const info = $('#serverInfo');
    if (SERVER.on) {
      info.className = 'server-info on';
      info.textContent = '🖥️ Tersambung ke server lokal — pesanan tersinkron ke semua perangkat. ' +
        (SERVER.ai ? (SERVER.modelInstalled ? `🤖 AI aktif (${SERVER.model})` : `⚠️ Model ${SERVER.model} belum di-pull`) : '🤖 Ollama tidak jalan');
    } else {
      info.className = 'server-info';
      info.textContent = '📱 Mode offline — data hanya tersimpan di perangkat ini.';
    }
    $('#insightCard').classList.toggle('hidden', !SERVER.ai);
    $('#aiModel').textContent = SERVER.model ? `Ollama · ${SERVER.model}` : '';
    renderCartBar();
  }
  function addMsg(role, text, extra) {
    const div = document.createElement('div');
    div.className = 'msg ' + role;
    div.textContent = text;
    if (extra) { const e = document.createElement('div'); e.className = 'added'; e.textContent = extra; div.appendChild(e); }
    $('#aiMessages').appendChild(div);
    $('#aiMessages').scrollTop = $('#aiMessages').scrollHeight;
    return div;
  }
  function openAi() {
    $('#aiSheet').classList.remove('hidden');
    if (!$('#aiMessages').children.length) {
      addMsg('bot', `Halo! Aku asisten ${C.brand.name} 👋\nKetik aja mau pesan apa, misal "baso urat taican 2 pedas, es mangga 1". Nanti aku masukin ke keranjang.`);
    }
    setTimeout(() => $('#aiInput').focus(), 150);
  }
  async function sendAi(text) {
    text = text.trim(); if (!text) return;
    addMsg('user', text); chat.push({ role: 'user', content: text });
    $('#aiInput').value = ''; $('#aiSend').disabled = true;
    const typing = addMsg('bot typing', 'Asisten sedang mengetik…');
    try {
      const res = await api('ai/chat', { method: 'POST', body: JSON.stringify({
        messages: chat, brand: C.brand.name, shipping: C.shipping,
        menu: C.menu.map(({ id, name, price, category, desc }) => ({ id, name, price, category, desc })),
      }) });
      typing.remove();
      const added = [];
      (res.items || []).forEach((it) => {
        const m = C.menu.find((x) => x.id === it.menuId);
        if (m) { addToCart(m, it.qty, it.note || ''); added.push(`✓ ${m.name} x${it.qty}${it.note ? ` (${it.note})` : ''}`); }
      });
      const extra = added.length ? `Masuk keranjang:\n${added.join('\n')}\nSubtotal keranjang: ${rupiah(cartSubtotal())}` : '';
      addMsg('bot', res.reply, extra);
      chat.push({ role: 'assistant', content: res.reply + (added.length ? `\n[Ditambahkan: ${added.join(', ')}]` : '') });
      if (added.length) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary sm'; btn.textContent = 'Lanjut Checkout →';
        btn.onclick = () => { $('#aiSheet').classList.add('hidden'); go('checkout'); };
        $('#aiMessages').appendChild(btn); $('#aiMessages').scrollTop = $('#aiMessages').scrollHeight;
      }
    } catch (e) {
      typing.remove(); chat.pop();
      addMsg('bot err', '⚠️ ' + e.message);
    } finally { $('#aiSend').disabled = false; }
  }
  $('#aiFab').onclick = openAi;
  $('#aiClose').onclick = () => $('#aiSheet').classList.add('hidden');
  $('#aiSheet').addEventListener('click', (e) => { if (e.target.id === 'aiSheet') $('#aiSheet').classList.add('hidden'); });
  $('#aiForm').addEventListener('submit', (e) => { e.preventDefault(); sendAi($('#aiInput').value); });
  $('#aiSuggest').addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) sendAi(b.dataset.q); });

  $('#btnInsight').onclick = async () => {
    const r = state.lastReport;
    if (!r || !r.count) return toast('Belum ada transaksi di tanggal ini');
    const btn = $('#btnInsight'); btn.disabled = true; btn.textContent = '🤖 AI sedang menganalisa…';
    const hours = {};
    r.orders.forEach((o) => { const h = new Date(o.createdAt).getHours(); hours[h] = (hours[h] || 0) + 1; });
    try {
      const res = await api('ai/insight', { method: 'POST', body: JSON.stringify({
        date: $('#reportDate').value,
        report: { total: r.total, subtotal: r.subtotal, shipping: r.shipping, count: r.count, porsi: r.porsi, online: r.online, pos: r.pos,
          perItem: r.perItem, perPay: r.perPay, hours: Object.entries(hours).sort((a, b) => a[0] - b[0]).map(([h, n]) => `${String(h).padStart(2, '0')}:00 (${n} trx)`) },
        menu: C.menu.map(({ name }) => ({ name })),
      }) });
      $('#insightText').textContent = res.insight;
    } catch (e) { $('#insightText').textContent = '⚠️ ' + e.message; }
    finally { btn.disabled = false; btn.textContent = 'Buat Ulang Insight'; }
  };
  $('#reportDate').addEventListener('change', () => { $('#insightText').innerHTML = '<p class="hint">Minta AI membaca laporan tanggal ini.</p>'; $('#btnInsight').textContent = 'Buat Insight'; });

  // Polling pesanan baru tiap 5 detik saat kasir terbuka (mode server)
  setInterval(async () => {
    if (SERVER.on && currentView === 'kasir' && isUnlocked()) {
      if (await syncOrders()) { renderOrders(); renderReport(); }
    }
  }, 5000);

  /* ---------- Init ---------- */
  renderBrand(); renderMenu(); renderCartBar();
  if (location.hash === '#kasir') go('kasir');
  detectServer().then(() => { if (currentView === 'kasir' && isUnlocked()) renderKasir(); });
})();
