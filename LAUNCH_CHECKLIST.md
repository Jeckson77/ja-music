# PulseTopup Launch Checklist

## Currently ready
- [x] Dark indigo/purple + gold responsive storefront
- [x] Blood Strike Gold catalogue with N$ prices (starter **sample** prices)
- [x] Player ID and email validation
- [x] Order IDs, persistent records, demo payments, order status lookup
- [x] Admin dashboard for orders and catalogue price changes
- [x] SELCOM test/live checkout adapter and signed webhook verification
- [x] Optional authorized supplier adapter for GameCore and verified manual fulfillment
- [x] Safety guards preventing accidental live selling on unconfigured accounts
- [x] Five backend API tests passing

## Needed before accepting real money
- [ ] Decide business name, register business if necessary and write real privacy/terms/refund/support pages
- [ ] Confirm written permission for third-party top-ups under Blood Strike/NetEase rules
- [ ] Obtain approved supplier account with Gold fulfillment available in your region, or approved manual fulfillment
- [ ] Obtain and verify SELCOM Namibia merchant access and your accepted payment methods
- [ ] Review supplier wholesale rates, transaction fees and NAD/USD margin; approve actual package prices
- [ ] Put secret keys on the deployment platform, not in the code or GitHub
- [ ] Configure HTTPS, SELCOM webhook URL and GameCore webhook and confirm signatures on real test events
- [ ] Fund legitimate supplier wallet and test a small real order through the entire pipeline
- [ ] Perform recovery tests for payment cancellations, failed delivery and refund processing
- [ ] Add anti-fraud/checkout rate limiting, error monitoring, user support, and a reconciliation scheduler
- [ ] Confirm compliance with Namibian payment, privacy and consumer regulations

This package is a working demo/storefront foundation, **not an activated live money-taking service**.