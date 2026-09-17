# Skillmark Chrome Web Store submission

Status: preparation only. No listing has been uploaded, submitted, approved, or published.

## Publisher details

- Product: Skillmark
- Support email: dannyhong2310@gmail.com
- Website reserved for deployment: https://skillmark-dannylabs.hushed-prawn-8015.chatgpt.site
- Privacy policy route: /privacy on that website. Verify public availability before submission.
- Account: the owner confirmed an existing Chrome Web Store developer account. No authenticated publisher browser is connected to this task yet.

## Listing text

Short description:

Save web pages, explain selected terms, and turn your reading into a personal learning and career workspace.

Detailed description:

Skillmark brings the ideas you discover online into one learning workspace.

- Save an article with the extension popup.
- Get summaries and topics for saved pages.
- Select a term and press Ctrl+Shift+E (Command+Shift+E on macOS) to request an explanation.
- Save explanations as flashcards and review them in your workspace.
- Explore career suggestions based on the topics in your saved reading.

Sign in with the same account in the extension and website to access your saved content. A Skillmark account and internet connection are required for saving, syncing, and AI features. Explanation results may include Vietnamese. Browser settings pages and other protected pages are not supported.

Skillmark reads page content only when you choose to save or explain it. Saved URLs, titles, extracted text, selected text, and nearby context are sent to the cloud backend to provide these features. See the privacy policy for details. AI suggestions can be inaccurate and are intended for exploration.

## Permission justifications

- activeTab: temporarily read the page the user explicitly chooses to save or explain; no continuous browser-history access.
- scripting: inject the packaged extraction and selection interface into the active tab after the user invokes the feature.
- storage: persist the authenticated session and workspace URL between popup openings.
- https://kfdmduogwpgolhybqeez.supabase.co/*: authenticate users, save selected content and flashcards, and call explanation functions on the existing backend.
- Remotely hosted executable code: none. Supabase is bundled; extraction runs locally. Network requests exchange data, not executable scripts.

Single purpose: help users turn deliberately saved web reading and selected terms into a personal learning workspace.

## Privacy fields to review against the deployed backend

The client handles personally identifiable information (account email), authentication information, website content, and URLs of deliberately saved pages. Do not declare that no data is collected. The repo does not contain the deployed server functions: confirm the actual AI processors, retention, and downstream data use before completing the store's privacy attestations.

## Finish submission

1. Verify the public website, /privacy, sign-up email redirects, and sign-in using a dedicated reviewer/test account. Save a bookmark and flashcard and run career analysis against the deployed backend.
2. Build with SKILLMARK_WEBSITE_URL set to the real HTTPS origin: npm run build:store. Upload artifacts/skillmark-chrome-store.zip, not the local preview package. Its workspace default and homepage point to the website.
3. In the publisher dashboard, create an item and upload the ZIP. Record its real extension ID and listing URL; do not invent an ID.
4. Add the listing description, support contact, privacy URL, permission explanations, a correctly sized icon, a small promotional image, and real screenshots of the working extension. Browser access is needed to capture the actual signed-in workflow; do not substitute fabricated data or mockups as proof of functionality.
5. Supply reviewer sign-in instructions/test access as requested by the dashboard. Complete account verification and privacy attestations, then submit for Google's review.
6. After approval and publication, configure VITE_CHROME_WEB_STORE_URL with the actual listing URL, rebuild and redeploy the website. Verify both Add to Chrome links lead to the listing and a clean Chrome profile can install and use it without ZIP extraction.

The site cannot grant Chrome installation permissions itself. Google controls review and publication timing.

Official references: https://developer.chrome.com/docs/webstore/publish/ ; https://developer.chrome.com/docs/webstore/images ; https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
