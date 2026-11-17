# Ja Music — frontend-skills improvement pass

Reference: [dawidolko/frontend-skills](https://github.com/dawidolko/frontend-skills) (MIT). This update follows its responsive, accessibility, image-performance and SEO guidance; it does **not** claim an automatically passing Lighthouse score or a completed WCAG audit.

## Improvements applied
- `responsive/reflow`, `responsive/dynamic-viewport-units`: mobile-first app shell at narrow widths, safe-area-aware phone navigation, responsive homepage spacing, no horizontally overflowing content.
- `a11y/focus-visible`, `a11y/target-size`, `a11y/control-name`: stronger keyboard focus indicators, minimum interactive targets, active app-tab `aria-current`, live toast status and Escape-to-dismiss menus.
- `css/reduced-motion`: animations and transitions honor user reduced-motion preferences.
- `perf/img-dimensions`: existing hero image intrinsic dimensions retained and stable aspect ratio reinforced; below-the-fold image loading preserved.
- `seo/canonical-valid`, `seo/og-absolute-url`: index and demo page canonical URLs plus absolute Open Graph image links.
- Brand treatment: blue listener, warm-gold Studio cards and matching tab-selection accents, while preserving Ja Music's Liquid Glass styling.
- Both Android APK variants now package the new frontend CSS/JS assets. The two-phone simulator embeds the enhanced Listener and Studio interface HTML.

## Behaviour preserved
- Demo logins, song discovery, artwork, publishing, purchasing, gifting, redemption, artist analytics, wallet and payout simulation.
- The demo still uses browser-local shared state; installed standalone APKs cannot synchronize across devices without a production backend.

## Verify
Run `node scripts/check-frontends.mjs` (Node.js 20+), then in a browser test homepage, demo and apps at 320px, 390px, 768px, 1280px; keyboard tab, Escape, 200% zoom, reduced motion, gift checkout, and the connected publish → purchase → earnings flow. Re-run the upstream CLI with `npx github:dawidolko/frontend-skills audit` for an optional advisory scan.

## Follow-up technical debt
The app HTML currently embeds significant artwork as data URLs, making pages and the two-phone simulator large. A future non-breaking migration should externalize compressed artwork into versioned files, add `srcset` where appropriate, and build real cloud synchronization with protected accounts. These improvements do **not** introduce live payments or licensed song streaming.
