# Ja Music — Gift a Song (prototype)

Ja Music now supports a working *demo* gifting flow, separate from ordinary buying:

1. Open a fictional/rights-cleared Ja Music release in the **Listener** app.
2. Tap **Buy for someone else**, or proceed to Checkout and choose that option.
3. Enter a Namibian mobile number, for example `081 123 4567` or `+264 81 123 4567`.
4. Confirm the **simulated purchase**. The app records a single sale in the shared demo data and increases Studio's artist earnings based on the proposed share.
5. The buyer receives a code like `JM-XXXXXXXX`. They can copy it and share it manually; no SMS is sent.
6. To demonstrate receipt on the same browser or connected local SQLite demo, open **Library → Redeem a music gift**, supply the same phone number and code, and confirm.
7. The release appears as **Gift received** in Library; redeeming never creates a second sale.

**Important limitations:** This is a browser/Android WebView prototype, not a public gifting payment system. It does not send SMS, verify phone ownership, process money, make real transfers, or synchronize separate installed APKs across devices. Phone numbers and gift codes are stored in local demonstration data (or the optional local SQLite demo server); use test numbers only. The public site has browser-local data isolated per visitor. A production implementation needs authenticated user accounts, secure server-side redemption, phone verification, privacy controls, reliable cross-device database, licensed content, and a verified payment gateway.

The artist Studio display remains unchanged, but gift orders are included in simulated sales, earnings, and transaction history. No real Namibian artist-reference catalogue entries are sold in this prototype.
