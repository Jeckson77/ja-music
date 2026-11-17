# Ja Music — React migration (development branch)

This branch introduces a complete React + Vite redesign of the public-facing Ja Music website.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Production build

```bash
npm run build
npm run preview
```

The Vite build writes to `dist/`. Its build plugin copies the existing `ja_music_dual_demo.html` and `assets/` directory so that the existing Listener and Studio interactive demonstration continues to work during migration.

## Render deployment (after review)

**Do not point the existing production Render service at this branch until it is reviewed.**

Use a separate Render Static Site preview configured with:
- Branch: `development`
- Build command: `npm install && npm run build`
- Publish directory: `dist`

After testing, merge `development` into `main` and update the existing production Render static site to use the same build command and publish directory.

## Migration status

- React 19 + Vite: implemented
- Main landing page, responsive navigation, sections, artist/listener toggle, FAQ: implemented in React
- React demo landing experience: implemented
- Legacy Listener and Studio interactive demo: **preserved, not yet rewritten in React**
- Automated browser testing, end-to-end checkout flows, production deployment: **not yet verified**
- Real payments: **not supported; demo only**

This branch is a work-in-progress and does not change the live production site until intentionally deployed.
