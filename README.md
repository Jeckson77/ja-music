# PulseTopup · Blood Strike Top-up Store

A functional **Namibia-first, mobile-friendly top-up storefront** with a dark violet/indigo gaming theme, N$ (NAD) product catalogue, order tracking, admin tools, and guarded payment/supplier integrations.

## Important truth about what works

**Works immediately in demo:** browse/select packs, validate Player IDs, place persistent orders, simulate payments, track order states, update catalogue prices, and view administrative orders.

**Requires real merchant credentials:** SELCOM hosted checkout in Namibia. Supports SELCOM test and live keys; card details are entered on the payment provider's page, never on the site.

**Requires verified supply access and permission:** real Blood Strike credit delivery. Supports a GameCore B2B API adapter for **eligible** supply accounts or staff-verified manual fulfillment. A public supplier catalogue alone does not grant access, prove game-publisher authorization, or guarantee availability. Contact Blood Strike/NetEase and the proposed supplier to establish permission before accepting live payments. Prices in the starter catalogue are **illustrative and not validated wholesale-backed prices**. Every SKU must now be individually approved in the admin catalogue before live mode lists it.

Do not advertise instant delivery until the integration is verified on the *live* merchant account and replenished supplier wallet. The application refuses to start in `selcom_live` mode without appropriate credentials, durable-storage confirmation and explicit operator approval. Without those items it is a demo, even if publicly hosted.

## Run locally (Windows, Mac, Linux)

```bash
cd pulsetopup
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Windows PowerShell: Copy-Item .env.example .env
# Generate a random admin key and paste it into .env:
python -c "import secrets; print(secrets.token_urlsafe(36))"
python -m uvicorn app:app --reload --port 8000
```

Open **http://127.0.0.1:8000**. Select a package, enter a numeric test player ID (5–20 digits) and email, accept the confirmations, and complete a **simulated** top-up. Select *Track your order* to see the order. The *Admin* link in the footer requires the `ADMIN_KEY` from `.env`.

Avoid using an actual account ID in demo. No money or game credit changes hands in demo mode.

## Platform and file layout

- `static/index.html` — public storefront: hero, games, packages, checkout, tracking, FAQs, admin modal
- `static/styles.css` — responsive dark indigo/violet + gold design
- `static/app.js` — frontend requests, validation, UI and tracking
- `app.py` — FastAPI, SQLite orders/catalogue, test/live SELCOM integration, supplier adapter, admin endpoints
- `tests/test_store.py` — demo API smoke/security tests
- `.env.example` — environment variable template
- `Dockerfile`, `render.yaml` — deployment setup

## SELCOM payment integration

Read [SELCOM's hosted checkout guide](https://selcom.com.na/developers/quickstart), [webhook documentation](https://selcom.com.na/developers/webhooks), and [API reference](https://selcom.com.na/developers/reference).

1. Register a merchant account, complete KYC and request test keys (approval and merchant availability must be verified).
2. In `.env`, set `PAYMENT_MODE=selcom_test`, a `pk_test_…` key, `sk_test_…` key and matching webhook signing secret. Set `FULFILLMENT_MODE=manual` to require staff to verify and mark sandbox-paid orders as fulfilled in the admin panel (these are still test transactions, **never** real Gold delivery).
3. Set `PUBLIC_URL` to the HTTPS deployment address. Configure webhook URL at `https://yourdomain/api/webhooks/selcom` in SELCOM console for the relevant key. Never embed the secret key in browser JavaScript.
4. Test successful payment, cancelled payment, declined card, duplicate webhook, and reconnection. The app validates amount, NAD currency, order reference, intent ID and HMAC signature before fulfillment.

**Do not switch to live** unless a supplier account and merchant account have both been verified, price caps have been reviewed, and live-mode prerequisites are satisfied. The site deliberately displays which payment mode is active.

## GameCore API adapter

Read [GameCore's Blood Strike listing](https://gamecore-api.tech/en/supply/blood-strike), [orders API](https://gamecore-api.tech/en/docs/orders), and [catalog API](https://gamecore-api.tech/en/docs/catalog). This is a third-party reseller, **not proof of NetEase authorization**. Independently verify legitimacy and permitted methods.

Product IDs are seeded from its public catalogue listing; they must be confirmed as available to **your own API key**. Supplier prices are USD, GameCore's wallet funding is USDT on its documented Product API, and supplier orders require a prepaid balance. You must assess FX exposure, supply availability and markups before charging NAD customers.

For `gamecore_live`, set `GAMECORE_KEY` to an approved live key, `GAMECORE_WEBHOOK_SECRET` as provisioned, set `SUPPLY_AUTHORIZATION_CONFIRMED=true` **only after verification**, and set `CATALOG_PRICES_APPROVED=true` after reviewing every live price and supplier USD cost cap. For each product, use the admin API to set `max_wholesale_usd_cents` to a conservative approved limit, or disable it. If the supplier reports unexpected required delivery fields or the price is above the approved cap, delivery is held for staff review, not silently claimed successful.

⚠️ **GameCore test keys can have different behavior depending on account provisioning.** Do *not* enable automatic `gamecore_test` with a partner-issued key unless GameCore confirms its orders cannot dispatch to live suppliers. Set `GAMECORE_TEST_RAIL_CONFIRMED=true` only for a verified simulation rail. By default, test fulfillment is blocked.

Supplier webhooks need correct signatures; the gamecore integration should be revalidated against your account's webhook format prior to production. The current sample handles one `id_only` line per retail order; do not add multi-SKU bundles without extending the one-to-many supplier order model. A periodic reconciliation worker, support queue, refunds, transaction ledger, real receipt email, rate limiting/CAPTCHA, access controls, automated monitoring, privacy/consumer-law review, merchant policies, and penetration testing are recommended before public launch.

## Moving this deployed store to real payments

See **[REAL_PAYMENTS_SETUP.md](REAL_PAYMENTS_SETUP.md)** for the exact safe activation sequence on the current Render deployment and required provider-side settings. There are NO real merchant credentials in this repository. Do not put secret keys in GitHub, browser JavaScript, a chat message, screenshots or order notes.

The admin dashboard shows readiness indicators and allows manual review, pricing and approval per Gold pack. The operator must still provide a legal supplier, make sure Gold delivery can happen, and verify purchase/refund terms. A sandbox or simulated payment is not a financial transaction.

**Important:** Render Free has an ephemeral filesystem. This SQLite implementation MUST be moved onto an attached persistent disk on a paid Render web service (with regular backups) before accepting real payments. Setting `DURABLE_STORAGE_CONFIRMED=true` without actually provisioning the disk risks losing paid orders. The app cannot independently prove that a container path is persistent.

## Live setup checklist

- SELCOM live merchant approval, verified NAD payment settlement and settlement bank account
- Legally authorized game top-up fulfillment or an approved reseller supplier relationship
- Per-SKU mapped supplier product IDs, availability, regional restrictions and confirmed margins
- Supplier wallet funded; set appropriate approved USD price caps
- Configure unique `ADMIN_KEY` (at least 24 characters) and verified webhook secrets
- Use HTTPS with a durable database and secure backups; configure your domain, logging and privacy terms
- Perform real low-value end-to-end purchase, ID validation, delivery, failed-delivery recovery and refund tests
- Do not launch without support contacts, privacy policy, purchase/refund policy and authorization checks

## Deploy on Render

Import the project as a GitHub repository and select **Blueprint** with `render.yaml`, or create a Docker Web Service. The supplied Blueprint proposes a paid starter plan with a disk mounted at `/var/data` for SQLite; applying it may incur charges. The current deployed Free web service has **no persistent disk**. Keep **one** Uvicorn worker while using SQLite, or move to managed Postgres for scaling. Configure `PUBLIC_URL=https://your-real-service-url.onrender.com`, a long random `ADMIN_KEY`, and keep `PAYMENT_MODE=demo`, `FULFILLMENT_MODE=demo` until the live setup is complete. Test with `curl https://your-real-service-url.onrender.com/api/health`.

## Testing

```bash
pytest -q
```

Run in a fresh virtual environment with the dependencies above. `GET /api/health` reports the configured mode; `GET /api/meta` drives the visible demo/live label. Neither proves a supplier connection on its own.

## Liability and brand

This is an independent starter platform, not TOPUPLive source code and not an official Blood Strike/NetEase service. Use your own logos, rights-cleared artwork, and legal business information. Avoid suggesting official game affiliation. Protect player IDs, email addresses and all payment event data.