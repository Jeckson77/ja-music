"""PulseTopup: Blood Strike top-up storefront with demo, SELCOM and GameCore adapters.

Demo mode is local-only simulation. Live checkout is deliberately guarded behind
explicit merchant and authorized-supply configuration.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import httpx
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / '.env')
except ImportError:
    pass

PAYMENT_MODE = os.getenv('PAYMENT_MODE', 'demo').strip()  # demo | selcom_test | selcom_live
FULFILLMENT_MODE = os.getenv('FULFILLMENT_MODE', 'demo').strip()  # demo | manual | gamecore_test | gamecore_live
PUBLIC_URL = os.getenv('PUBLIC_URL', 'http://127.0.0.1:8000').rstrip('/')
DB_PATH = Path(os.getenv('DATABASE_PATH', str(ROOT / 'store.db')))
ADMIN_KEY = os.getenv('ADMIN_KEY', '')
SHOP_NAME = os.getenv('SHOP_NAME', 'PulseTopup')
SUPPLY_AUTHORIZATION_CONFIRMED = os.getenv('SUPPLY_AUTHORIZATION_CONFIRMED', 'false').lower() == 'true'
CATALOG_PRICES_APPROVED = os.getenv('CATALOG_PRICES_APPROVED', 'false').lower() == 'true'
SELCOM_PK = os.getenv('SELCOM_PK', '')
SELCOM_SK = os.getenv('SELCOM_SK', '')
SELCOM_WEBHOOK_SECRET = os.getenv('SELCOM_WEBHOOK_SECRET', '')
GAMECORE_KEY = os.getenv('GAMECORE_KEY', '')
GAMECORE_WEBHOOK_SECRET = os.getenv('GAMECORE_WEBHOOK_SECRET', '')
# Some partner-issued gc_test keys may still use live supply. Confirm a true simulation rail.
GAMECORE_TEST_RAIL_CONFIRMED = os.getenv('GAMECORE_TEST_RAIL_CONFIRMED', 'false').lower() == 'true'
SELCOM_API = 'https://api.selcom.com.na' if PAYMENT_MODE == 'selcom_live' else 'https://staging-api.selcom.com.na'
GAMECORE_API = 'https://api.gamecore-api.tech'

if PAYMENT_MODE not in ('demo', 'selcom_test', 'selcom_live'):
    raise RuntimeError('Invalid PAYMENT_MODE')
if FULFILLMENT_MODE not in ('demo', 'manual', 'gamecore_test', 'gamecore_live'):
    raise RuntimeError('Invalid FULFILLMENT_MODE')
if PAYMENT_MODE == 'selcom_live':
    required = {
        'HTTPS PUBLIC_URL': PUBLIC_URL.startswith('https://'),
        'SELCOM_PK live': SELCOM_PK.startswith('pk_live_'),
        'SELCOM_SK live': SELCOM_SK.startswith('sk_live_'),
        'SELCOM_WEBHOOK_SECRET': bool(SELCOM_WEBHOOK_SECRET),
        'SUPPLY_AUTHORIZATION_CONFIRMED': SUPPLY_AUTHORIZATION_CONFIRMED,
        'CATALOG_PRICES_APPROVED': CATALOG_PRICES_APPROVED,
        'live fulfillment': FULFILLMENT_MODE in ('gamecore_live', 'manual'),
        'ADMIN_KEY length>=24': len(ADMIN_KEY) >= 24,
    }
    if FULFILLMENT_MODE == 'gamecore_live':
        required['GAMECORE_KEY live'] = GAMECORE_KEY.startswith('gc_live_')
        required['GAMECORE_WEBHOOK_SECRET'] = bool(GAMECORE_WEBHOOK_SECRET)
    missing = [k for k, valid in required.items() if not valid]
    if missing:
        raise RuntimeError('Refusing live checkout with incomplete configuration: ' + ', '.join(missing))
if PAYMENT_MODE == 'demo' and FULFILLMENT_MODE in ('gamecore_live', 'manual'):
    raise RuntimeError('Demo payments must not trigger real delivery')
if PAYMENT_MODE != 'demo' and FULFILLMENT_MODE == 'demo':
    raise RuntimeError('Real/sandbox payment must not automatically mark an item delivered in demo fulfillment')
if FULFILLMENT_MODE == 'gamecore_live' and PAYMENT_MODE != 'selcom_live':
    raise RuntimeError('Real gold delivery requires real, verified payment')
if PAYMENT_MODE == 'selcom_test' and (not SELCOM_PK.startswith('pk_test_') or not SELCOM_SK.startswith('sk_test_') or not SELCOM_WEBHOOK_SECRET):
    raise RuntimeError('SELCOM test keys and webhook secret required')
if FULFILLMENT_MODE == 'gamecore_test' and not (GAMECORE_KEY.startswith('gc_test_') and GAMECORE_TEST_RAIL_CONFIRMED):
    raise RuntimeError('GAMECORE_KEY gc_test_ and GAMECORE_TEST_RAIL_CONFIRMED=true required: partner test keys can use real supply')
if FULFILLMENT_MODE == 'gamecore_live' and not GAMECORE_KEY.startswith('gc_live_'):
    raise RuntimeError('GAMECORE_KEY gc_live_ required')

app = FastAPI(title=SHOP_NAME, version='1.0.0', docs_url='/api/docs', redoc_url=None)

SEED_PRODUCTS = [
    ('gold-51', '51 Gold', 51, 1200, 129045554, 0, 'Starter'),
    ('gold-105', '105 Gold', 105, 2400, 288, 0, ''),
    ('gold-320', '320 Gold', 320, 6900, 289, 0, 'Popular'),
    ('gold-540', '540 Gold', 540, 11900, 290, 0, ''),
    ('gold-1100', '1,100 Gold', 1100, 23900, 291, 0, 'Best value'),
    ('gold-2260', '2,260 Gold', 2260, 45900, 292, 0, ''),
]


def utcnow():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


@contextmanager
def db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=20, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA busy_timeout=20000')
    conn.execute('PRAGMA foreign_keys=ON')
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with db() as c:
        c.execute('PRAGMA journal_mode=WAL')
        c.executescript('''
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            gold INTEGER NOT NULL,
            price_cents INTEGER NOT NULL CHECK(price_cents > 0),
            supplier_product_id INTEGER NOT NULL,
            max_wholesale_usd_cents INTEGER NOT NULL DEFAULT 0,
            badge TEXT NOT NULL DEFAULT '',
            active INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL REFERENCES products(id),
            email TEXT NOT NULL,
            player_id TEXT NOT NULL,
            price_cents INTEGER NOT NULL,
            currency TEXT NOT NULL DEFAULT 'NAD',
            status TEXT NOT NULL DEFAULT 'awaiting_payment',
            payment_intent TEXT UNIQUE,
            checkout_url TEXT,
            supplier_code TEXT,
            fulfillment_reference TEXT,
            error_note TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            CHECK(price_cents > 0)
        );
        CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE TABLE IF NOT EXISTS processed_events (
            id TEXT PRIMARY KEY, provider TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT, action TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL
        );
        ''')
        for row in SEED_PRODUCTS:
            c.execute('INSERT OR IGNORE INTO products (id,title,gold,price_cents,supplier_product_id,max_wholesale_usd_cents,badge) VALUES (?,?,?,?,?,?,?)', row)


init_db()


def row_dict(row):
    return dict(row) if row is not None else None


def order_public(row):
    d = row_dict(row)
    return {k: d.get(k) for k in ('id','product_id','player_id','price_cents','currency','status','supplier_code','fulfillment_reference','created_at','updated_at','error_note')}


def audit(c, order_id, action, note=''):
    c.execute('INSERT INTO audit_log(order_id,action,note,created_at) VALUES (?,?,?,?)', (order_id, action, note[:500], utcnow()))


def need_admin(x_admin_key):
    if not ADMIN_KEY or len(ADMIN_KEY) < 24 or not hmac.compare_digest(ADMIN_KEY, x_admin_key or ''):
        raise HTTPException(401, 'Invalid admin key (configure a strong ADMIN_KEY in .env)')


def need_order(order_id, email):
    with db() as c:
        row = c.execute('SELECT * FROM orders WHERE id=?', (order_id,)).fetchone()
    if not row or not hmac.compare_digest(row['email'], (email or '').strip().lower()):
        raise HTTPException(404, 'Order not found for that email')
    return row


def signature_ok(raw: bytes, secret: str, timestamp: str | None, provided: str | None, prefix='') -> bool:
    if not secret or not timestamp or not provided:
        return False
    try:
        if abs(int(time.time()) - int(timestamp)) > 300:
            return False
    except (ValueError, TypeError):
        return False
    expected = prefix + hmac.new(secret.encode(), timestamp.encode() + b'.' + raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, provided)


def record_paid(order_id: str, intent_id: str, source: str):
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        row = c.execute('SELECT * FROM orders WHERE id=?', (order_id,)).fetchone()
        if not row:
            c.execute('ROLLBACK')
            raise HTTPException(404, 'Order not found')
        if row['payment_intent'] and row['payment_intent'] != intent_id:
            c.execute('ROLLBACK')
            raise HTTPException(409, 'Payment intent mismatch')
        if row['status'] == 'awaiting_payment':
            c.execute('UPDATE orders SET status=?, payment_intent=?, updated_at=? WHERE id=?', ('paid_awaiting_delivery', intent_id, utcnow(), order_id))
            audit(c, order_id, 'payment_confirmed', source)
            changed = True
        else:
            changed = False
        c.execute('COMMIT')
    return changed


async def selcom_get(intent_id: str):
    async with httpx.AsyncClient(timeout=14.0) as client:
        r = await client.get(f'{SELCOM_API}/api/plugin/merchant/payments/{intent_id}', headers={'Authorization': f'Bearer {SELCOM_SK}'})
        r.raise_for_status()
        data = r.json()
        return data.get('data', data)


def verify_payment_payload(order, p):
    ref = p.get('merchantReference') or p.get('reference')
    if (p.get('status') != 'SUCCEEDED' or ref != order['id'] or
        int(p.get('amount', -1)) != order['price_cents'] or p.get('currency') != 'NAD' or
        p.get('intentId') != order['payment_intent']):
        raise HTTPException(409, 'Payment did not match the order')


async def supplier_get(path):
    async with httpx.AsyncClient(timeout=16) as client:
        r = await client.get(GAMECORE_API + path, headers={'X-Api-Key': GAMECORE_KEY})
        r.raise_for_status()
        body = r.json()
        if not body.get('success', False):
            raise RuntimeError('Supplier rejected lookup')
        return body['data']


async def dispatch_supplier(order_id: str):
    """Idempotent send. Failed/ambiguous sends are safe to retry with fixed UUID5."""
    if FULFILLMENT_MODE not in ('gamecore_test', 'gamecore_live'):
        return
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        updated = c.execute('UPDATE orders SET status=?,updated_at=? WHERE id=? AND status=?',
                            ('supplier_submitting', utcnow(), order_id, 'paid_awaiting_delivery')).rowcount
        c.execute('COMMIT')
        if not updated:
            return
        row = c.execute('''SELECT o.*, p.supplier_product_id, p.max_wholesale_usd_cents FROM orders o
                          JOIN products p ON p.id=o.product_id WHERE o.id=?''', (order_id,)).fetchone()
    try:
        product = await supplier_get(f'/b2b/catalog/products/{row["supplier_product_id"]}')
        schema = product.get('deliveryDataSchema') or []
        required = [f for f in schema if f.get('required')]
        if (product.get('deliveryType') != 'id_only' or len(required) != 1 or
            required[0].get('type') not in ('text', 'number') or len(schema) != 1):
            raise RuntimeError('Supplier delivery fields require manual mapping/approval')
        cost_cents = round(float(product.get('wholesalePrice', 0)) * 100)
        if not row['max_wholesale_usd_cents'] or not 0 < cost_cents <= row['max_wholesale_usd_cents']:
            raise RuntimeError('Wholesale cost above approved cap or cap not configured')
        if product.get('currency') != 'USD':
            raise RuntimeError('Unexpected supplier billing currency')
        payload = {
            'items': [{'productId': int(row['supplier_product_id']), 'quantity': 1,
                       'deliveryData': {required[0]['id']: row['player_id']}}],
            'externalOrderId': order_id,
        }
        if PUBLIC_URL.startswith('https://') and GAMECORE_WEBHOOK_SECRET:
            payload['callbackUrl'] = PUBLIC_URL + '/api/webhooks/gamecore'
        stable_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, 'pulsetopup:supplier:' + order_id))
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(GAMECORE_API + '/b2b/orders', json=payload,
                                  headers={'X-Api-Key': GAMECORE_KEY, 'X-Idempotency-Key': stable_uuid})
            r.raise_for_status()
            reply = r.json()
        orders = reply.get('data', {}).get('orders') or []
        if not reply.get('success') or len(orders) != 1 or not orders[0].get('code'):
            raise RuntimeError('Unexpected supplier order response; inspect before retrying')
        code = orders[0]['code']
        with db() as c:
            c.execute('UPDATE orders SET supplier_code=?, status=CASE WHEN status=? THEN ? ELSE status END, error_note=NULL, updated_at=? WHERE id=?',
                      (code, 'supplier_submitting', 'supplier_processing', utcnow(), order_id))
            audit(c, order_id, 'supplier_submitted', code)
        await reconcile_supplier(order_id)
    except Exception as exc:
        # Stable supplier idempotency key means a retry must not double-charge.
        with db() as c:
            c.execute('UPDATE orders SET status=CASE WHEN status=? THEN ? ELSE status END, error_note=?, updated_at=? WHERE id=?',
                      ('supplier_submitting', 'paid_awaiting_delivery', str(exc)[:240], utcnow(), order_id))
            audit(c, order_id, 'supplier_dispatch_error', str(exc)[:240])


async def reconcile_supplier(order_id: str):
    with db() as c:
        row = c.execute('SELECT * FROM orders WHERE id=?', (order_id,)).fetchone()
    if not row or not row['supplier_code'] or row['status'] not in ('supplier_processing', 'paid_awaiting_delivery'):
        return
    try:
        state = await supplier_get('/b2b/orders/' + row['supplier_code'])
        st = state.get('status')
        with db() as c:
            if st == 'completed':
                final = 'demo_delivered' if FULFILLMENT_MODE == 'gamecore_test' else 'delivered'
                c.execute('UPDATE orders SET status=?,error_note=NULL,updated_at=? WHERE id=? AND status IN (?,?)',
                          (final, utcnow(), order_id, 'supplier_processing', 'paid_awaiting_delivery'))
                audit(c, order_id, 'supplier_completed', row['supplier_code'])
            elif st in ('failed', 'refunded', 'cancelled'):
                c.execute('UPDATE orders SET status=?, error_note=?,updated_at=? WHERE id=? AND status IN (?,?)',
                          ('delivery_failed', 'Supplier reported: ' + st, utcnow(), order_id, 'supplier_processing', 'paid_awaiting_delivery'))
                audit(c, order_id, 'supplier_failed', st)
    except Exception:
        pass  # Reconcile again later; never invent a success.


class NewOrder(BaseModel):
    product_id: str
    player_id: str = Field(min_length=5, max_length=22)
    email: str = Field(min_length=5, max_length=255)
    confirmed_player_id: bool
    accepted_terms: bool


class OrderEmail(BaseModel):
    email: str


class ManualFulfil(BaseModel):
    reference: str = Field(min_length=4, max_length=150)


class PriceChange(BaseModel):
    price_cents: int = Field(ge=100, le=5_000_000)
    max_wholesale_usd_cents: int = Field(ge=0, le=1_000_000)
    active: bool


@app.get('/api/health')
def health():
    return {'ok': True, 'payment_mode': PAYMENT_MODE, 'fulfillment_mode': FULFILLMENT_MODE}


@app.get('/api/meta')
def meta():
    return {'shop_name': SHOP_NAME, 'payment_mode': PAYMENT_MODE,
            'fulfillment_mode': FULFILLMENT_MODE, 'currency': 'NAD',
            'demo': PAYMENT_MODE == 'demo',
            'notice': ('Simulation: no money or game currency changes hands.' if PAYMENT_MODE == 'demo'
                       else 'Sandbox payment: no real money changes hands.' if PAYMENT_MODE == 'selcom_test'
                       else 'Live payments enabled. Top-ups fulfilled through configured authorized supplier.')}


@app.get('/api/products')
def products():
    with db() as c:
        return [row_dict(r) for r in c.execute('SELECT id,title,gold,price_cents,badge FROM products WHERE active=1 ORDER BY gold')]


@app.post('/api/orders', status_code=201)
def create_order(body: NewOrder):
    email = body.email.strip().lower()
    uid = body.player_id.strip()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        raise HTTPException(422, 'Enter a valid email address')
    if not re.fullmatch(r'[0-9]{5,20}', uid):
        raise HTTPException(422, 'Blood Strike User ID must contain 5–20 digits')
    if not body.confirmed_player_id or not body.accepted_terms:
        raise HTTPException(422, 'Please confirm the ID and accept the terms')
    with db() as c:
        product = c.execute('SELECT * FROM products WHERE id=? AND active=1', (body.product_id,)).fetchone()
        if not product:
            raise HTTPException(404, 'Product is unavailable')
        order_id = 'PT-' + secrets.token_hex(7).upper()
        timestamp = utcnow()
        c.execute('''INSERT INTO orders(id,product_id,email,player_id,price_cents,created_at,updated_at)
                     VALUES(?,?,?,?,?,?,?)''', (order_id, product['id'], email, uid, product['price_cents'], timestamp, timestamp))
        audit(c, order_id, 'created', 'Order placed')
    return {'id': order_id, 'email': email, 'price_cents': product['price_cents'], 'status': 'awaiting_payment'}


@app.get('/api/orders/{order_id}')
def order_status(order_id: str, email: str):
    return order_public(need_order(order_id, email))


@app.post('/api/orders/{order_id}/checkout')
async def checkout(order_id: str, body: OrderEmail, background_tasks: BackgroundTasks):
    order = need_order(order_id, body.email)
    if order['status'] != 'awaiting_payment':
        return {'id': order_id, 'status': order['status'], 'checkout_url': order['checkout_url']}
    if PAYMENT_MODE == 'demo':
        with db() as c:
            c.execute('BEGIN IMMEDIATE')
            c.execute("UPDATE orders SET status='demo_delivered',payment_intent=?,updated_at=? WHERE id=? AND status='awaiting_payment'",
                      ('demo-' + order_id, utcnow(), order_id))
            audit(c, order_id, 'demo_checkout', 'Simulated payment and top-up; no Gold sent')
            c.execute('COMMIT')
        return {'id': order_id, 'status': 'demo_delivered', 'demo': True}
    if order['checkout_url']:
        return {'id': order_id, 'status': order['status'], 'checkout_url': order['checkout_url']}
    if PAYMENT_MODE == 'selcom_live' and FULFILLMENT_MODE == 'gamecore_live':
        with db() as c:
            product = c.execute('SELECT max_wholesale_usd_cents FROM products WHERE id=?', (order['product_id'],)).fetchone()
        if not product or product['max_wholesale_usd_cents'] <= 0:
            raise HTTPException(503, 'Product supply cost cap has not been approved')
    payload = {
        'amount': order['price_cents'], 'currency': 'NAD', 'merchantReference': order_id,
        'description': f'{SHOP_NAME} Blood Strike {order["product_id"]}',
        'customer': {'email': order['email']}, 'hostedCheckout': True,
        'successUrl': PUBLIC_URL + '/?order=' + order_id,
        'cancelUrl': PUBLIC_URL + '/?order=' + order_id,
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(SELCOM_API + '/api/plugin/sessions', json=payload,
                headers={'X-Plugin-Key': SELCOM_PK, 'Idempotency-Key': str(uuid.uuid5(uuid.NAMESPACE_URL, 'pulsetopup:payment:' + order_id))})
            r.raise_for_status()
            response = r.json().get('data', {})
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, 'Payment service did not create a session; try again shortly') from exc
    if not response.get('intentId') or not response.get('checkoutUrl', '').startswith('https://'):
        raise HTTPException(502, 'Payment provider did not return a hosted checkout URL')
    with db() as c:
        c.execute('UPDATE orders SET payment_intent=?,checkout_url=?,updated_at=? WHERE id=? AND payment_intent IS NULL',
                  (response['intentId'], response['checkoutUrl'], utcnow(), order_id))
        audit(c, order_id, 'checkout_created', response['intentId'])
    return {'id': order_id, 'status': 'awaiting_payment', 'checkout_url': response['checkoutUrl']}


@app.post('/api/orders/{order_id}/refresh')
async def refresh_payment(order_id: str, body: OrderEmail, background_tasks: BackgroundTasks):
    order = need_order(order_id, body.email)
    if PAYMENT_MODE == 'demo' or not order['payment_intent'] or order['status'] != 'awaiting_payment':
        return order_public(order)
    try:
        payment = await selcom_get(order['payment_intent'])
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, 'Payment status temporarily unavailable')
    if payment.get('status') == 'SUCCEEDED':
        verify_payment_payload(order, payment)
        if record_paid(order_id, payment['intentId'], 'server_side_lookup'):
            background_tasks.add_task(dispatch_supplier, order_id)
    return order_public(need_order(order_id, body.email))


@app.post('/api/webhooks/selcom')
async def selcom_webhook(request: Request, background_tasks: BackgroundTasks):
    raw = await request.body()
    if not signature_ok(raw, SELCOM_WEBHOOK_SECRET, request.headers.get('X-Selcom-Timestamp'),
                        request.headers.get('X-Selcom-Signature')):
        raise HTTPException(401, 'Invalid signature')
    data = json.loads(raw)
    if data.get('test') is True:
        return {'ok': True, 'ignored': 'webhook tester'}
    event = data.get('event', '')
    payload = data.get('data') or {}
    event_key = request.headers.get('X-Selcom-Idempotency-Key') or hashlib.sha256(raw).hexdigest()
    if event not in ('payment.succeeded','payment.failed','payment.refunded','payment.partially_refunded'):
        return {'ok': True, 'ignored': 'other event'}
    order_id = payload.get('merchantReference') or payload.get('reference')
    with db() as c:
        order = c.execute('SELECT * FROM orders WHERE id=?', (order_id,)).fetchone()
    if not order:
        raise HTTPException(409, 'Unknown order')
    if (payload.get('currency') != 'NAD' or int(payload.get('amount', -1)) != order['price_cents'] or
        payload.get('intentId') != order['payment_intent']):
        raise HTTPException(409, 'Webhook/payment mismatch')
    with db() as c:
        try:
            c.execute('INSERT INTO processed_events(id,provider,created_at) VALUES (?,?,?)', ('selcom:' + event_key, 'selcom', utcnow()))
        except sqlite3.IntegrityError:
            return {'ok': True, 'duplicate': True}
    if event == 'payment.succeeded' and payload.get('status') == 'SUCCEEDED':
        if record_paid(order_id, payload['intentId'], 'signed_selcom_webhook'):
            background_tasks.add_task(dispatch_supplier, order_id)
    elif event in ('payment.refunded','payment.partially_refunded'):
        with db() as c:
            c.execute("UPDATE orders SET status='refund_review',updated_at=? WHERE id=? AND status IN ('paid_awaiting_delivery','supplier_processing','delivered','delivery_failed')", (utcnow(), order_id))
            audit(c, order_id, event, 'Refund requires manual stock reconciliation')
    return {'ok': True}


@app.post('/api/webhooks/gamecore')
async def gamecore_webhook(request: Request):
    raw = await request.body()
    if not signature_ok(raw, GAMECORE_WEBHOOK_SECRET, request.headers.get('X-Webhook-Timestamp'),
                        request.headers.get('X-Webhook-Signature'), 'sha256='):
        raise HTTPException(401, 'Invalid signature')
    event = json.loads(raw)
    et = event.get('event_type')
    if et not in ('order.completed', 'order.failed'):
        return {'ok': True, 'ignored': True}
    payload = event.get('data') or {}
    order_id = payload.get('externalOrderId')
    code = payload.get('orderCode')
    event_id = request.headers.get('X-Idempotency-Key') or event.get('event_id')
    if not event_id or not order_id or not code:
        raise HTTPException(500, 'Malformed supplier event')
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        row = c.execute('SELECT * FROM orders WHERE id=?', (order_id,)).fetchone()
        if not row or row['status'] not in ('supplier_submitting','supplier_processing','delivered','demo_delivered','delivery_failed'):
            c.execute('ROLLBACK')
            raise HTTPException(500, 'Supplier order is not linked yet')
        if row['supplier_code'] and row['supplier_code'] != code:
            c.execute('ROLLBACK')
            raise HTTPException(500, 'Supplier reference mismatch')
        if c.execute('SELECT 1 FROM processed_events WHERE id=?', ('gamecore:' + event_id,)).fetchone():
            c.execute('COMMIT')
            return {'ok': True, 'duplicate': True}
        c.execute('INSERT INTO processed_events(id,provider,created_at) VALUES(?,?,?)', ('gamecore:' + event_id, 'gamecore', utcnow()))
        if row['status'] in ('supplier_submitting','supplier_processing'):
            new_state = ('demo_delivered' if FULFILLMENT_MODE == 'gamecore_test' else 'delivered') if et == 'order.completed' else 'delivery_failed'
            c.execute('UPDATE orders SET status=?,supplier_code=?,error_note=?,updated_at=? WHERE id=?',
                      (new_state, code, None if et == 'order.completed' else str(payload.get('error') or 'Supplier failed')[:240], utcnow(), order_id))
            audit(c, order_id, et, code)
        c.execute('COMMIT')
    return {'ok': True}


@app.get('/api/admin/orders')
def admin_orders(x_admin_key: str | None = Header(default=None)):
    need_admin(x_admin_key)
    with db() as c:
        return [row_dict(r) for r in c.execute('''SELECT o.*,p.title FROM orders o JOIN products p ON p.id=o.product_id ORDER BY o.created_at DESC LIMIT 250''')]


@app.get('/api/admin/products')
def admin_products(x_admin_key: str | None = Header(default=None)):
    need_admin(x_admin_key)
    with db() as c:
        return [row_dict(r) for r in c.execute('SELECT * FROM products ORDER BY gold')]


@app.put('/api/admin/products/{product_id}')
def update_product(product_id: str, change: PriceChange, x_admin_key: str | None = Header(default=None)):
    need_admin(x_admin_key)
    with db() as c:
        n = c.execute('UPDATE products SET price_cents=?,max_wholesale_usd_cents=?,active=? WHERE id=?',
                      (change.price_cents, change.max_wholesale_usd_cents, int(change.active), product_id)).rowcount
    if not n:
        raise HTTPException(404, 'Product not found')
    return {'ok': True}


@app.post('/api/admin/orders/{order_id}/fulfill')
def manual_fulfill(order_id: str, body: ManualFulfil, x_admin_key: str | None = Header(default=None)):
    need_admin(x_admin_key)
    if FULFILLMENT_MODE != 'manual':
        raise HTTPException(409, 'Manual fulfillment is disabled')
    with db() as c:
        n = c.execute("UPDATE orders SET status='delivered',fulfillment_reference=?,updated_at=? WHERE id=? AND status='paid_awaiting_delivery'",
                      (body.reference.strip(), utcnow(), order_id)).rowcount
        if n:
            audit(c, order_id, 'manually_fulfilled', body.reference)
    if not n:
        raise HTTPException(409, 'Order not in paid-and-pending state')
    return {'ok': True}


@app.post('/api/admin/orders/{order_id}/retry')
async def admin_retry(order_id: str, x_admin_key: str | None = Header(default=None)):
    need_admin(x_admin_key)
    await dispatch_supplier(order_id)
    with db() as c:
        r = c.execute('SELECT * FROM orders WHERE id=?', (order_id,)).fetchone()
    if not r:
        raise HTTPException(404, 'Order not found')
    return order_public(r)


@app.post('/api/admin/orders/{order_id}/reconcile')
async def admin_reconcile(order_id: str, x_admin_key: str | None = Header(default=None)):
    need_admin(x_admin_key)
    if FULFILLMENT_MODE not in ('gamecore_test','gamecore_live'):
        raise HTTPException(409, 'Supplier API is not enabled')
    await reconcile_supplier(order_id)
    with db() as c:
        r = c.execute('SELECT * FROM orders WHERE id=?', (order_id,)).fetchone()
    if not r:
        raise HTTPException(404, 'Order not found')
    return order_public(r)


@app.get('/')
def root():
    return FileResponse(ROOT / 'static' / 'index.html')


app.mount('/static', StaticFiles(directory=ROOT / 'static'), name='static')