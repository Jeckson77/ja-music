# Ja Music — Polished Mobile UI V4 (12 Nov 2026)

Separate Listener and Studio apps retain the same demo purchase, gift redemption, publishing, and simulated earnings logic.

## New design work
- Smaller, consistent five-tab liquid-glass navigation with accessible labels and icon outlines.
- Listener navigation: Home, Search, Library, Gifts, Profile. The Gifts tab links to the existing redeem flow.
- Artist Studio navigation: Overview, Releases, Analytics, Wallet, Profile, with gold active state.
- Original AI-created illustrative artwork embedded offline for three fictional demonstration releases; additional generic illustrated tiles for search references and moods. No official album art or likenesses from real performers are used.
- Artwork now follows the same release through discovery, search, album, checkout, player, library, Studio release list and analytics.
- Improved card spacing, shadows, safe-area handling, and true edge-to-edge layout on small/mobile screens.
- Studio uploader image selection shows a local preview; original upload persistence unchanged.

## What did not change
- Demo account credentials; release records and simulation data; purchase and gift rules; royalty calculation; backend structure.
- No real transactions or licensed playback; physical APKs still do not share a cloud database.

## Run
Open `ja_music_dual_demo.html` for the two-phone local browser demo, or run the bundled SQLite server from the connected source package. On public hosting, access `/ja_music_dual_demo.html`.

## QA
JS syntax was checked, and Playwright smoke-tested mobile layouts and navigation on both apps, search, gifts redemption shortcut, album artwork, Studio releases, upload preview and analytics.
