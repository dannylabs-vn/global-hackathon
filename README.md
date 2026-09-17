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

Run npm run build and npm run build:extension. With a test account, save a bookmark in the extension and check /learn#highlights, save a flashcard and check /learn#flashcards, then run career analysis. The workspace refreshes every 10 seconds while visible and when the browser window regains focus.

## Personal roadmaps and practice

In Career Analysis, select a career to inspect its skills, then choose **Confirm — I want to follow this path**. Enter your experience, goal, timezone, available days/time windows, pace, and constraints. A plan covers the first 1–4 weeks, with one session per available day. The server assigns the exact dates and times; AI supplies milestones, activities, deliverables, and practice questions. Sessions never extend beyond the specified time windows or deadline. Past time windows today are skipped.

Set **DEEPSEEK_API_KEY** in Vercel's Production and Preview environment variables, then redeploy. Do not use a `VITE_` prefix: the key must remain server-side. `DEEPSEEK_MODEL` optionally overrides the default `deepseek-flash` model. No new Supabase tables or privileged Supabase key are required. The `/api/learning-plan` Vercel function validates the existing Supabase bearer session, calls DeepSeek's JSON chat completion API, and validates the response before returning it. Missing credentials or an AI failure shows an error and preserves the previous plan. Vercel allows up to 120 seconds for this function.

For local development, copy `.env.example` to `.env.local` and set the DeepSeek key there. `npm run dev` serves the same handler through Vite. Never commit `.env.local`. Refer to [DeepSeek JSON mode](https://api-docs.deepseek.com/guides/json_mode/) for provider configuration.

Practice includes the generated roadmap's activities and questions, plus recall practice using real saved flashcards. Completion is self-reported after answering the question and recording work/reflection. Plans, answers, notes, completion, and flashcard review state are stored per account in this browser; **they do not sync across devices**. Export your plan to keep a copy. Generating a replacement plan resets session progress only after successful generation.

Run `npm run test:extension` after rebuilding the worker. These tests cover service-worker startup and signed-out session handling in a simulated extension environment, repeated saves on the same page, and package references. They do not replace a live Chrome installation and authenticated backend check.

Run `npm run test:learning` to validate scheduling, authentication, provider failure handling, account isolation, and the career → questionnaire → roadmap → practice interaction. These tests stub the AI provider and do not spend API credits; verify generation with your own signed-in account after configuring the production key.
