# Skillmark

The landing page from master is preserved. The authenticated workspace and browser extension come from duy and share its Supabase project.

## Run the website

Run npm install, then npm run dev. Open http://127.0.0.1:5173. The workspace is at /learn and authentication is at /login.

Choose **Set up extension** in the workspace or sign-in page, or visit `/extension` directly. The setup page provides the current ZIP download and the website address to paste into extension Settings. Both `npm run dev` and `npm run build` rebuild and package the extension automatically. Development uses port 5173 and reports a conflict instead of silently moving to another port.

## Load the extension

Run npm run build:extension. In Chrome, open chrome://extensions, enable Developer mode, select Load unpacked, and choose the extension directory. Sign in with the same account as the website. Save a page, then select Open workspace to view bookmarks. Highlight text and press Ctrl+Shift+E (Command+Shift+E on macOS) to explain it and save a flashcard.

For this Windows checkout, choose `C:\Users\HONG DAO KIET\Desktop\Global Hackathon\extension` in the folder picker. This is the folder containing `manifest.json`; selecting the parent `Global Hackathon` folder will fail. The bundled worker is already included, so you do not need to build before the first load. If already installed, click Reload on the Skillmark card in `chrome://extensions`, then refresh the article tab before trying again. Pin Skillmark from Chrome's Extensions menu to open its popup.

Both landing-page Add to Chrome links open installation without requiring sign-in. Set VITE_CHROME_WEB_STORE_URL to Skillmark's published listing URL and rebuild to send visitors directly to the Chrome Web Store. Until a listing is configured, the links open /extension for preview installation using Load unpacked. The website cannot display Chrome's native installation prompt for an unpublished extension. To use the portable `artifacts/skillmark-extension.zip` package or website download, extract it first, then select the extracted folder containing `manifest.json` with Load unpacked. Chrome cannot load the ZIP directly. The archive includes only runtime files and has the manifest at its root.

Open an ordinary HTTP/HTTPS article to test saving. Chrome settings, the Chrome Web Store, and other protected pages do not permit content injection. Use the popup's Settings button to configure the website address; keep `npm run dev` running when using the default local address.

For deployment, open the extension Details > Extension options and set the website address. The web host must serve index.html for /learn and /login. Rebuild and reload the extension after changing its source.

## Backend prerequisites

The duy branch contains clients for an existing Supabase backend, not server source or database migrations. That project must have bookmarks, bookmark_analysis, career_reports, and flashcards tables, authenticated user row-level security policies, the bookmark analysis trigger, and analyze-career and explain-keyword Edge Functions. Auth email redirects must allow the website origin. Browser and extension sessions are separate; use the same account in both. Never put a service-role key in either client.

## Verify

Run npm run build and npm run build:extension. With a test account, save a bookmark in the extension and check /learn#highlights, save a flashcard and check /learn#flashcards, then run career analysis. The workspace refreshes every 15 seconds while visible and when the browser window regains focus. Practice and preference edits are session-only.

Run `npm run test:extension` after rebuilding the worker. These tests cover service-worker startup and signed-out session handling in a simulated extension environment, repeated saves on the same page, and package references. They do not replace a live Chrome installation and authenticated backend check.
