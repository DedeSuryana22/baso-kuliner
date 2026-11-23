"""
=====================================================================
 BASO KULINER — Server Lokal + Asisten AI (Ollama)
=====================================================================
 Cara pakai (IDLE):
   1. Buka file ini di IDLE  ->  tekan F5 (Run Module)
   2. Browser otomatis terbuka ke http://localhost:8000
   3. Untuk berhenti: Ctrl+C di IDLE Shell, atau menu Shell > Restart Shell

 Tidak perlu pip install apa pun (hanya library bawaan Python 3.8+).

 Fitur tambahan dibanding versi GitHub Pages:
   - Pesanan tersimpan di database SQLite (data/baso_kuliner.db), jadi
     semua HP yang buka aplikasi lewat WiFi yang sama melihat data yang sama.
   - Asisten AI (Ollama): customer ketik pesanan bebas -> masuk keranjang.
   - Insight AI di laporan kasir.

 Ollama (opsional, tapi wajib untuk fitur AI):
   - Install dari https://ollama.com
   - Di Command Prompt jalankan:  ollama pull qwen2.5:3b
   - Biarkan aplikasi Ollama tetap jalan.
=====================================================================
"""
import json
import mimetypes
import os
import socket
import sqlite3
import sys
import threading
import urllib.error
import urllib.request
import webbrowser
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

# ------------------------- KONFIGURASI -------------------------
PORT = 8000                                   # ganti kalau bentrok
OLLAMA_URL = os.environ.get('OLLAMA_URL', 'http://localhost:11434')
OLLAMA_MODEL = os.environ.get('OLLAMA_MODEL', 'qwen2.5:3b')   # bisa: llama3.2:3b, gemma2:2b, qwen2.5:7b
OLLAMA_TIMEOUT = 120                          # detik (laptop tanpa GPU bisa lambat)
OPEN_BROWSER = True
# ---------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DB_PATH = os.environ.get('BK_DB', os.path.join(DATA_DIR, 'baso_kuliner.db'))
BLOCKED_PREFIXES = ('/data', '/tests', '/.git', '/node_modules')
BLOCKED_EXT = ('.py', '.pyc', '.db', '.sqlite')
DB_LOCK = threading.Lock()
mimetypes.add_type('application/manifest+json', '.json')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('text/javascript', '.js')


# =========================== DATABASE ===========================
def db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with db() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            date_key TEXT NOT NULL,
            channel TEXT, status TEXT, payment TEXT, total INTEGER,
            data TEXT NOT NULL,
            updated_at TEXT)""")
        c.execute("CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date_key)")


def local_date_key(iso):
    try:
        dt = datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone()
    except Exception:
        dt = datetime.now()
    return dt.strftime('%Y-%m-%d')


def save_order(o):
    required = ('id', 'createdAt', 'items', 'total')
    if not all(k in o for k in required) or not isinstance(o['items'], list):
        raise ValueError('Data pesanan tidak lengkap')
    with DB_LOCK, db() as c:
        exists = c.execute('SELECT 1 FROM orders WHERE id=?', (o['id'],)).fetchone()
        if exists:
            return False
        c.execute('INSERT INTO orders (id, created_at, date_key, channel, status, payment, total, data, updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
                  (o['id'], o['createdAt'], local_date_key(o['createdAt']), o.get('channel'), o.get('status'),
                   o.get('payment'), int(o.get('total') or 0), json.dumps(o, ensure_ascii=False), datetime.now().isoformat()))
    return True


def list_orders(date_key=None, limit=500):
    with db() as c:
        if date_key:
            rows = c.execute('SELECT data FROM orders WHERE date_key=? ORDER BY created_at DESC', (date_key,)).fetchall()
        else:
            rows = c.execute('SELECT data FROM orders ORDER BY created_at DESC LIMIT ?', (limit,)).fetchall()
    return [json.loads(r['data']) for r in rows]


def update_order(oid, patch):
    allowed = {'status'}
    with DB_LOCK, db() as c:
        row = c.execute('SELECT data FROM orders WHERE id=?', (oid,)).fetchone()
        if not row:
            return None
        o = json.loads(row['data'])
        for k, v in patch.items():
            if k in allowed:
                o[k] = v
        o['updatedAt'] = datetime.now().isoformat()
        c.execute('UPDATE orders SET data=?, status=?, updated_at=? WHERE id=?',
                  (json.dumps(o, ensure_ascii=False), o.get('status'), o['updatedAt'], oid))
    return o


def delete_order(oid):
    with DB_LOCK, db() as c:
        return c.execute('DELETE FROM orders WHERE id=?', (oid,)).rowcount > 0


# ============================ OLLAMA ============================
def ollama_request(path, payload=None, timeout=OLLAMA_TIMEOUT):
    url = OLLAMA_URL.rstrip('/') + path
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'},
                                 method='POST' if data else 'GET')
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def ollama_status():
    try:
        tags = ollama_request('/api/tags', timeout=3)
        models = [m.get('name', '') for m in tags.get('models', [])]
        want = OLLAMA_MODEL if ':' in OLLAMA_MODEL else OLLAMA_MODEL + ':latest'
        return {'running': True, 'model': OLLAMA_MODEL, 'modelInstalled': want in models, 'models': models}
    except Exception:
        return {'running': False, 'model': OLLAMA_MODEL, 'modelInstalled': False, 'models': []}


def ollama_chat(messages, fmt=None, temperature=0.2):
    payload = {'model': OLLAMA_MODEL, 'messages': messages, 'stream': False,
               'options': {'temperature': temperature}}
    if fmt is not None:
        payload['format'] = fmt
    try:
        res = ollama_request('/api/chat', payload)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise ValueError(f'Model {OLLAMA_MODEL} belum terpasang. Jalankan: ollama pull {OLLAMA_MODEL}')
        if isinstance(fmt, dict):          # Ollama versi lama (<0.5) belum dukung JSON schema
            payload['format'] = 'json'
            res = ollama_request('/api/chat', payload)
        else:
            raise
    return (res.get('message') or {}).get('content', '')


def rupiah(n):
    return 'Rp ' + f'{int(n or 0):,}'.replace(',', '.')


ORDER_SCHEMA = {
    'type': 'object',
    'properties': {
        'reply': {'type': 'string'},
        'items': {'type': 'array', 'items': {
            'type': 'object',
            'properties': {'menuId': {'type': 'string'}, 'qty': {'type': 'integer'}, 'note': {'type': 'string'}},
            'required': ['menuId', 'qty']}},
    },
    'required': ['reply', 'items'],
}


def ai_order_chat(body):
    """Ubah teks bebas customer menjadi item keranjang + jawaban ramah."""
    menu = body.get('menu') or []
    history = body.get('messages') or []
    brand = body.get('brand') or 'Baso Kuliner'
    shipping = body.get('shipping') or {}
    menu_lines = '\n'.join(f"- id={m['id']} | {m['name']} | {rupiah(m['price'])} | {m.get('category','')} | {m.get('desc','')}" for m in menu)
    system = f"""Kamu adalah "Asisten {brand}", pelayan ramah warung baso. Jawab dalam bahasa Indonesia santai dan singkat (maks 3 kalimat).
MENU (hanya ini yang dijual):
{menu_lines}
Ongkir: gratis jika jarak <= {shipping.get('freeRadiusKm', 2)} km, lebih dari itu {rupiah(shipping.get('ratePerKm', 2500))}/km (dihitung otomatis saat checkout dari pin peta).

ATURAN:
1. Jika customer menyebut menu yang ingin dipesan, isi "items" dengan menuId PERSIS dari daftar, qty (angka, default 1), dan note (level pedas / tanpa seledri / kuah dipisah, kosongkan jika tidak ada).
2. Jika customer hanya bertanya / ngobrol, "items" = [].
3. Jangan mengarang menu, harga, promo, atau jam buka yang tidak ada di atas. Jika menu tidak tersedia, bilang tidak ada dan tawarkan yang mirip.
4. Di "reply", sebutkan apa yang dimasukkan ke keranjang dan subtotalnya, lalu ajak lanjut checkout.
5. Balas HANYA JSON: {{"reply": "...", "items": [{{"menuId": "...", "qty": 1, "note": ""}}]}}"""
    msgs = [{'role': 'system', 'content': system}]
    for m in history[-8:]:
        if m.get('role') in ('user', 'assistant') and m.get('content'):
            msgs.append({'role': m['role'], 'content': str(m['content'])[:1000]})
    raw = ollama_chat(msgs, fmt=ORDER_SCHEMA)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find('{'), raw.rfind('}')
        data = json.loads(raw[start:end + 1]) if start >= 0 else {'reply': raw, 'items': []}
    # Validasi: buang menuId yang tidak ada, batasi qty
    valid = {m['id']: m for m in menu}
    items, dropped = [], []
    for it in data.get('items') or []:
        mid = str(it.get('menuId', '')).strip()
        if mid in valid:
            try:
                qty = max(1, min(50, int(it.get('qty') or 1)))
            except (TypeError, ValueError):
                qty = 1
            items.append({'menuId': mid, 'qty': qty, 'note': str(it.get('note') or '').strip()[:120]})
        elif mid:
            dropped.append(mid)
    reply = str(data.get('reply') or '').strip() or 'Siap!'
    if dropped:
        reply += f"\n(Catatan: {', '.join(dropped)} tidak ada di menu, jadi tidak dimasukkan.)"
    return {'reply': reply, 'items': items}


def ai_insight(body):
    """Insight laporan harian. Angka dihitung di frontend, AI hanya menafsirkan."""
    r = body.get('report') or {}
    date = body.get('date') or ''
    per_item = r.get('perItem') or {}
    lines = [f"Tanggal: {date}",
             f"Omzet total (termasuk ongkir): {rupiah(r.get('total'))}",
             f"Omzet makanan/minuman: {rupiah(r.get('subtotal'))}",
             f"Ongkir: {rupiah(r.get('shipping'))}",
             f"Jumlah transaksi: {r.get('count', 0)}",
             f"Total porsi: {r.get('porsi', 0)}",
             f"Online: {rupiah(r.get('online'))} | Kasir/makan di tempat: {rupiah(r.get('pos'))}",
             'Per menu: ' + '; '.join(f"{k} {v.get('qty')} porsi ({rupiah(v.get('omzet'))})" for k, v in per_item.items()),
             'Per metode bayar: ' + '; '.join(f"{k} {rupiah(v)}" for k, v in (r.get('perPay') or {}).items()),
             'Jam transaksi: ' + ', '.join(r.get('hours') or [])]
    menu_names = ', '.join(m['name'] for m in body.get('menu') or [])
    system = ("Kamu analis bisnis untuk warung baso kecil di Bekasi. Tulis insight singkat dalam bahasa Indonesia, "
              "format: 3-5 poin bullet (pakai '- '), lalu 1 baris 'Saran besok:'. "
              "Gunakan HANYA angka dari data. Jangan mengarang angka, target, atau tren yang tidak ada di data. "
              "Jika data sedikit, katakan datanya belum cukup untuk menyimpulkan pola. "
              f"Menu yang dijual: {menu_names}.")
    return {'insight': ollama_chat([{'role': 'system', 'content': system},
                                    {'role': 'user', 'content': '\n'.join(lines)}], temperature=0.3).strip()}


# ============================ HTTP ==============================
class Handler(SimpleHTTPRequestHandler):
    server_version = 'BasoKuliner/1.0'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def log_message(self, fmt, *args):
        if '/api/' in str(args[0] if args else ''):
            sys.stdout.write(f"[{datetime.now():%H:%M:%S}] {fmt % args}\n")

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store' if self.path.startswith('/api/') else 'no-cache')
        super().end_headers()

    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n > 2_000_000:
            raise ValueError('Request terlalu besar')
        return json.loads(self.rfile.read(n).decode() or '{}') if n else {}

    # ---- static (blokir file sensitif) ----
    def do_GET(self):
        url = urlparse(self.path)
        if url.path.startswith('/api/'):
            return self.api('GET', url)
        low = url.path.lower()
        if low.startswith(BLOCKED_PREFIXES) or low.endswith(BLOCKED_EXT):
            return self.send_error(404)
        return super().do_GET()

    def do_POST(self):
        return self.api('POST', urlparse(self.path))

    def do_PATCH(self):
        return self.api('PATCH', urlparse(self.path))

    def do_DELETE(self):
        return self.api('DELETE', urlparse(self.path))

    # ---- API ----
    def api(self, method, url):
        p = url.path.rstrip('/')
        q = parse_qs(url.query)
        try:
            if p == '/api/health' and method == 'GET':
                return self.send_json({'ok': True, 'server': True, 'ollama': ollama_status()})
            if p == '/api/orders' and method == 'GET':
                return self.send_json({'orders': list_orders((q.get('date') or [None])[0])})
            if p == '/api/orders' and method == 'POST':
                created = save_order(self.read_json())
                return self.send_json({'ok': True, 'created': created}, 201 if created else 200)
            if p.startswith('/api/orders/'):
                oid = p.split('/')[-1]
                if method == 'PATCH':
                    o = update_order(oid, self.read_json())
                    return self.send_json({'ok': True, 'order': o}) if o else self.send_json({'error': 'Tidak ditemukan'}, 404)
                if method == 'DELETE':
                    return self.send_json({'ok': delete_order(oid)})
            if p == '/api/ai/chat' and method == 'POST':
                return self.send_json(ai_order_chat(self.read_json()))
            if p == '/api/ai/insight' and method == 'POST':
                return self.send_json(ai_insight(self.read_json()))
            return self.send_json({'error': 'Endpoint tidak ada'}, 404)
        except (urllib.error.URLError, ConnectionError, TimeoutError, socket.timeout) as e:
            return self.send_json({'error': f'Ollama tidak bisa dihubungi ({e}). Pastikan aplikasi Ollama jalan dan model {OLLAMA_MODEL} sudah di-pull.'}, 503)
        except (ValueError, json.JSONDecodeError) as e:
            return self.send_json({'error': str(e)}, 400)
        except Exception as e:  # jangan sampai server mati
            return self.send_json({'error': f'Server error: {e}'}, 500)


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()


def start_server(port=PORT):
    ThreadingHTTPServer.allow_reuse_address = True
    for p in range(port, port + 10):
        try:
            return ThreadingHTTPServer(('0.0.0.0', p), Handler), p
        except OSError:
            continue
    raise OSError(f'Port {port}-{port + 9} terpakai semua')


def main():
    init_db()
    httpd, port = start_server()
    st = ollama_status()
    print('=' * 60)
    print('  BASO KULINER — server jalan')
    print('=' * 60)
    print(f'  Laptop ini   : http://localhost:{port}')
    print(f'  HP (1 WiFi)  : http://{lan_ip()}:{port}')
    print(f'  Halaman kasir: http://localhost:{port}/#kasir')
    print(f'  Database     : {DB_PATH}')
    if not st['running']:
        print(f'  Ollama       : TIDAK JALAN -> fitur AI nonaktif (aplikasi lain tetap jalan)')
    elif not st['modelInstalled']:
        print(f'  Ollama       : jalan, tapi model {OLLAMA_MODEL} belum ada.')
        print(f'                 Jalankan di Command Prompt: ollama pull {OLLAMA_MODEL}')
    else:
        print(f'  Ollama       : OK ({OLLAMA_MODEL})')
    print('  Stop server  : Ctrl+C  (atau Shell > Restart Shell di IDLE)')
    print('=' * 60)
    if OPEN_BROWSER and not os.environ.get('BK_NO_BROWSER'):
        threading.Timer(1.0, lambda: webbrowser.open(f'http://localhost:{port}')).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nServer dihentikan.')
    finally:
        httpd.server_close()


if __name__ == '__main__':
    main()
