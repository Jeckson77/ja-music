# Ja Music public website deployment

This archive includes the original unchanged Ja Music prototype, marketing website, and two-phone simulator.

## Render static site
1. Create an empty GitHub repository for Ja Music under your intended GitHub account.
2. Commit the contents of this ZIP at the repository root.
3. In Render, create a **Static Site**, choose that repository, use build command `echo Ready`, and publish directory `.`.
4. The site will show the full website at `/`, and the interactive prototype at `/demo.html`.

## Data and security limitations
This is a **browser-only demonstration**. Artist and Listener apps share browser-local data in the same-origin two-phone simulator. Visitors using separate devices will NOT share a central database.
The local SQLite Python server is deliberately NOT included in this public upload: its demo state endpoint lacks authentication and must not be exposed directly. Transactions, wallets, artist profiles and login are simulated. Use fictional data only.

No changes were made to the original application HTML files.
