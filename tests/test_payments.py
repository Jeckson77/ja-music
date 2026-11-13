"""SELCOM hosted checkout and signed callback regression tests (no real money)."""
import hashlib
import hmac
import json
import time
import uuid

from test_store import client, module, new_order


def headers(raw: bytes, secret: str, ident='evt_once' + uuid.uuid4().hex):
    timestamp = str(int(time.time()))
    signature = hmac.new(secret.encode(), timestamp.encode() + b'.' + raw, hashlib.sha256).hexdigest()
    return {
        'X-Selcom-Timestamp': timestamp,
        'X-Selcom-Signature': signature,
        'X-Selcom-Idempotency-Key': ident,
        'Content-Type': 'application/json',
    }


def signed_payload(order_id, intent, amount, event='payment.succeeded'):
    return json.dumps({
        'event': event,
        'data': {
            'intentId': intent,
            'merchantReference': order_id,
            'amount': amount,
            'currency': 'NAD',
            'status': 'SUCCEEDED',
            'livemode': False,
        },
    }, separators=(',', ':')).encode()


def test_signed_success_duplicate_and_refund(monkeypatch):
    monkeypatch.setattr(module, 'PAYMENT_MODE', 'selcom_test')
    monkeypatch.setattr(module, 'FULFILLMENT_MODE', 'manual')
    monkeypatch.setattr(module, 'SELCOM_WEBHOOK_SECRET', 'whsec_test_only_never_use_in_production')
    order = new_order(email='signed_events@example.com').json()
    intent = 'pi_signed_test_' + uuid.uuid4().hex
    with module.db() as c:
        c.execute('UPDATE orders SET payment_intent=? WHERE id=?', (intent, order['id']))
    raw = signed_payload(order['id'], intent, order['price_cents'])
    response = client.post('/api/webhooks/selcom', content=raw, headers=headers(raw, module.SELCOM_WEBHOOK_SECRET))
    assert response.status_code == 200 and response.json()['duplicate'] is False
    assert client.get(f'/api/orders/{order["id"]}', params={'email': order['email']}).json()['status'] == 'paid_awaiting_delivery'
    duplicate = client.post('/api/webhooks/selcom', content=raw, headers=headers(raw, module.SELCOM_WEBHOOK_SECRET))
    assert duplicate.status_code == 200 and duplicate.json()['duplicate'] is True
    with module.db() as c:
        assert c.execute("SELECT count(*) FROM audit_log WHERE order_id=? AND action='payment_confirmed'", (order['id'],)).fetchone()[0] == 1
    refund = signed_payload(order['id'], intent, order['price_cents'], event='payment.refunded')
    response = client.post('/api/webhooks/selcom', content=refund, headers=headers(refund, module.SELCOM_WEBHOOK_SECRET, 'evt_refund_' + uuid.uuid4().hex))
    assert response.status_code == 200
    assert client.get(f'/api/orders/{order["id"]}', params={'email': order['email']}).json()['status'] == 'refund_review'


def test_payment_webhook_rejects_wrong_amount_and_retries_cleanly(monkeypatch):
    monkeypatch.setattr(module, 'PAYMENT_MODE', 'selcom_test')
    monkeypatch.setattr(module, 'FULFILLMENT_MODE', 'manual')
    monkeypatch.setattr(module, 'SELCOM_WEBHOOK_SECRET', 'whsec_fake_testing')
    order = new_order(email='wrong_amount@example.com').json()
    intent = 'pi_amount_mismatch_' + uuid.uuid4().hex
    with module.db() as c:
        c.execute('UPDATE orders SET payment_intent=? WHERE id=?', (intent, order['id']))
    event_key = 'evt_retry_' + uuid.uuid4().hex
    invalid = signed_payload(order['id'], intent, order['price_cents'] - 100)
    x = client.post('/api/webhooks/selcom', content=invalid, headers=headers(invalid, module.SELCOM_WEBHOOK_SECRET, event_key))
    assert x.status_code == 409
    valid = signed_payload(order['id'], intent, order['price_cents'])
    r = client.post('/api/webhooks/selcom', content=valid, headers=headers(valid, module.SELCOM_WEBHOOK_SECRET, event_key))
    assert r.status_code == 200 and not r.json()['duplicate']


def test_untrusted_checkout_url_rejected(monkeypatch):
    monkeypatch.setattr(module, 'PAYMENT_MODE', 'selcom_test')
    monkeypatch.setattr(module, 'FULFILLMENT_MODE', 'manual')
    monkeypatch.setattr(module, 'SELCOM_PK', 'pk_test_fake')
    order = new_order(email='untrusted_checkout@example.com').json()

    class Response:
        def raise_for_status(self): pass
        def json(self):
            return {'data': {'intentId': 'pi_url_test', 'checkoutUrl': 'https://checkout.selcom.com.na.attacker.invalid/sessions/1'}}

    class FakeClient:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): return None
        async def post(self, *args, **kwargs): return Response()

    monkeypatch.setattr(module.httpx, 'AsyncClient', FakeClient)
    response = client.post(f'/api/orders/{order["id"]}/checkout', json={'email': order['email']})
    assert response.status_code == 502
    assert 'trusted' in response.json()['detail']


def test_products_must_be_individually_approved_for_live(monkeypatch):
    monkeypatch.setattr(module, 'PAYMENT_MODE', 'selcom_live')
    assert client.get('/api/products').json() == []
    unapproved = new_order(email='not_approved@example.com')
    assert unapproved.status_code == 404