"""Smoke and security tests for the local demo. Run: pytest -q."""
import importlib.util
import os
import secrets
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
os.environ['DATABASE_PATH'] = str(ROOT / 'tests' / 'temporary_test_store.db')
os.environ['PAYMENT_MODE'] = 'demo'
os.environ['FULFILLMENT_MODE'] = 'demo'
os.environ['ADMIN_KEY'] = 'test-only-' + secrets.token_hex(16)
spec = importlib.util.spec_from_file_location('topup_app_test', ROOT / 'app.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
client = TestClient(module.app)


def new_order(email='player@example.com', product='gold-320'):
    return client.post('/api/orders', json={
        'product_id': product, 'player_id': '123456789', 'email': email,
        'confirmed_player_id': True, 'accepted_terms': True,
    })


def test_static_site_and_catalog():
    page = client.get('/')
    assert page.status_code == 200 and 'PULSE' in page.text
    assert client.get('/static/styles.css').status_code == 200
    assert client.get('/static/app.js').status_code == 200
    assert client.get('/api/meta').json()['demo'] is True
    products = client.get('/api/products').json()
    assert len(products) >= 3
    assert all(p['price_cents'] > 0 for p in products)
    assert 'supplier_product_id' not in products[0]


def test_demo_order_flow_and_idempotency():
    response = new_order()
    assert response.status_code == 201
    order = response.json(); assert order['status'] == 'awaiting_payment'
    denied = client.get(f'/api/orders/{order["id"]}', params={'email': 'wrong@example.com'})
    assert denied.status_code == 404
    checkout = client.post(f'/api/orders/{order["id"]}/checkout', json={'email': order['email']})
    assert checkout.status_code == 200 and checkout.json()['demo'] is True
    again = client.post(f'/api/orders/{order["id"]}/checkout', json={'email': order['email']})
    assert again.json()['status'] == 'demo_delivered'
    final = client.get(f'/api/orders/{order["id"]}', params={'email': order['email']}).json()
    assert final['status'] == 'demo_delivered'
    assert final['payment_intent'] if 'payment_intent' in final else True
    assert final['currency'] == 'NAD'


def test_validation_rejects_bad_ids_and_missing_consent():
    bad = client.post('/api/orders', json={'product_id':'gold-51','player_id':'not-a-number',
        'email':'player@example.com','confirmed_player_id':True,'accepted_terms':True})
    assert bad.status_code == 422
    missing_consent = client.post('/api/orders', json={'product_id':'gold-51','player_id':'123456789',
        'email':'player@example.com','confirmed_player_id':False,'accepted_terms':True})
    assert missing_consent.status_code == 422
    unknown = new_order(product='does-not-exist')
    assert unknown.status_code == 404


def test_admin_requires_secret_and_can_edit_price():
    assert client.get('/api/admin/orders').status_code == 401
    key = os.environ['ADMIN_KEY']; headers = {'X-Admin-Key': key}
    assert client.get('/api/admin/orders', headers=headers).status_code == 200
    changed = client.put('/api/admin/products/gold-51', headers=headers,
        json={'price_cents':1999,'max_wholesale_usd_cents':0,'active':True})
    assert changed.status_code == 200
    price = next(p for p in client.get('/api/products').json() if p['id']=='gold-51')
    assert price['price_cents'] == 1999
    # Demo cannot manually declare a real supplier fulfillment.
    fake = client.post('/api/admin/orders/nonexistent/fulfill', headers=headers, json={'reference':'fake123'})
    assert fake.status_code == 409


def test_forged_webhook_is_denied():
    response = client.post('/api/webhooks/selcom', json={'event':'payment.succeeded', 'data':{'status':'SUCCEEDED'}})
    assert response.status_code == 401