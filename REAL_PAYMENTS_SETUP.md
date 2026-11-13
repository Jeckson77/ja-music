# PulseTopup — real-payments activation checklist

**Current status:** the public website is a payment demonstration, not a live merchant and not an authorized Blood Strike Gold supplier. No real-money collection is enabled. The program has integrated server-side SELCOM hosted-checkout session creation, signed webhook handling, confirmed payment lookup, idempotency, refund review and an admin product-approval screen.

## 1. Establish a legitimate merchant and supplier

Register or use an approved Namibian business/merchant account and bank settlement account. Read SELCOM's [quickstart](https://selcom.com.na/developers/quickstart), [webhooks](https://selcom.com.na/developers/webhooks), and [go-live integration guide](https://selcom.com.na/developers/guides/payment-plugin-integration). Verify commercial terms and merchant approval directly with the provider before relying on it.

Secure a genuinely **authorized Blood Strike Gold fulfillment channel**. Obtain the provider's product IDs, regional eligibility rules, costs, crediting SLA, wallet requirements, and written permission to resell. Do not assume a listing on an unofficial aggregator means publisher authorization. Manual fulfillment is permissible only when there is a real process and someone will check and deliver every paid order; it is NOT automatic Gold delivery.

## 2. Make the order database durable before taking money

The Render Free web service at `https://pulsetopup-namibia.onrender.com` currently uses temporary local SQLite storage. Render says Free web services cannot attach persistent disks. Use either:

- **Paid Render web service with persistent disk:** attach a disk mounted at `/var/data`, set `DATABASE_PATH=/var/data/store.db`, keep a single Uvicorn worker, and make backups. The paid service/disk incurs charges.
- **A durable PostgreSQL database:** requires a code migration; the current application only supports SQLite. Do not just set DATABASE_URL and assume it works.

The launch gate `DURABLE_STORAGE_CONFIRMED=true` should only be set *after* you provision and verify persistent data and backups.

## 3. Obtain merchant test keys and verify end to end

In your SELCOM developer console obtain `SELCOM_PK=pk_test_…`, `SELCOM_SK=sk_test_…` and `SELCOM_WEBHOOK_SECRET=whsec_…`. In Render Environment configure `PAYMENT_MODE=selcom_test` and `FULFILLMENT_MODE=manual` (sandbox orders have no real money and must not be fulfilled with real Gold). Configure the test key's webhook URL:

`https://pulsetopup-namibia.onrender.com/api/webhooks/selcom`

Also set your exact public HTTPS origin as an allowed origin if required. Run SELCOM's signed **Send test** webhook and test a successful and declined sandbox checkout. Order status should move to `paid_awaiting_delivery` on success, `payment_failed` on a final failure, and `refund_review` on a refund event. The return URL alone never proves payment.

**Never use test keys to accept customer money.**

## 4. Approve each retail package

Open the site footer **Admin** dashboard using your private `ADMIN_KEY`. Verify each Gold package's real availability, cost, margin and supplier product ID. Update N$ retail prices and supplier maximum USD price caps (if using automated supply), and explicitly check `Price approved` for each SKU. Packages without that flag are hidden in live mode. This step is independent of `CATALOG_PRICES_APPROVED=true`.

## 5. Switch to live only after everything is verified

Apply these variables on the Render service's Environment page (not in source code):

```
PAYMENT_MODE=selcom_live
FULFILLMENT_MODE=manual                 # or gamecore_live when its integration is approved
PUBLIC_URL=https://pulsetopup-namibia.onrender.com
DATABASE_PATH=/var/data/store.db         # only after paid persistent disk is attached
SELCOM_PK=pk_live_<issued-by-provider>
SELCOM_SK=sk_live_<issued-by-provider>
SELCOM_WEBHOOK_SECRET=whsec_<issued-by-provider>
SUPPLY_AUTHORIZATION_CONFIRMED=true      # only after verifying legal supplier relationship
CATALOG_PRICES_APPROVED=true            # only after reviewing supplier-backed prices
DURABLE_STORAGE_CONFIRMED=true          # only after verified persistent DB + backups
ADMIN_KEY=<private-long-random-secret>
```

If using automatic supplier delivery, also provide its approved live API credentials and webhook signature secret and set correct per-SKU wholesale caps. Never enable live API delivery based only on a third-party supplier listing.

Provider console: request live/KYC approval and issue live keys; set production allowed origin `https://pulsetopup-namibia.onrender.com`; configure the live key's separate webhook URL (same path) and live webhook secret. Confirm your merchant settlement account and payment rail are enabled. Do one **explicitly authorized** low-value real charge and a refund before opening to the public. Track a paid order from the payment provider all the way to actual Gold delivery or manual fulfillment and examine logs for webhook retries/duplicates.

## 6. Production operations

Document refunds, disputes and support contacts; add terms, privacy policy, data retention and receipt delivery before opening publicly. Put order alerts and monitoring in place. Confirm the supplier can fulfill within the time stated on your checkout. Reconcile payments against provider reports daily and back up the order ledger. Consider rate limiting, fraud screening, phone/email verification, and a proper operator authentication system for larger volumes.

### Why the site will *not* just start charging today

There are currently no verified live SELCOM credentials, no verified authorized supplier contract, no approved real pricing, and no persistent disk on this Render Free deployment. The server intentionally refuses live-mode startup without those gates. Do not set the booleans to bypass the commercial checks.