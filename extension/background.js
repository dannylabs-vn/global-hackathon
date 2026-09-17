// background.js — Service Worker (Manifest V3)
// Responsibilities:
//   1. Maintain Supabase session across popup open/close cycles
//   2. Listen for messages from popup.js
//   3. Inject content-script into the active tab to extract page content
//   4. INSERT bookmark record into Supabase (pipeline AI runs automatically via DB trigger)
//
// Message protocol:
//   FROM popup.js  → { action: 'save-bookmark' }
//   FROM popup.js  → { action: 'get-session' }
//   FROM popup.js  → { action: 'sign-in', email, password }
//   FROM popup.js  → { action: 'sign-up', email, password }
//   FROM popup.js  → { action: 'sign-out' }
//   FROM content-script → { action: 'page-content', title, text }
//   FROM content-script → { action: 'explain-keyword', keyword, context }   (highlight-to-explain)
//   FROM content-script → { action: 'save-flashcard', keyword, explanation, source_url }

import { supabase } from './lib/supabase.js';

// ------------------------------------------------------------------
// Message router
// ------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // We must return true to keep the message channel open for async responses
  handleMessage(message, sender).then(sendResponse).catch((err) => {
    console.error('[background] Error handling message:', err);
    sendResponse({ success: false, error: err.message });
  });
  return true;
});

// ------------------------------------------------------------------
// Message handlers
// ------------------------------------------------------------------
async function handleMessage(message, sender) {
  switch (message.action) {
    case 'get-session':
      return handleGetSession();

    case 'sign-in':
      return handleSignIn(message.email, message.password);

    case 'sign-up':
      return handleSignUp(message.email, message.password);

    case 'sign-out':
      return handleSignOut();

    case 'save-bookmark':
      return handleSaveBookmark();

    case 'page-content':
      // Called from content-script after extraction; sender.tab has the tab info
      return handlePageContent(message, sender);

    case 'explain-keyword':
      return handleExplainKeyword(message.keyword, message.context);

    case 'save-flashcard':
      return handleSaveFlashcard(message);

    default:
      return { success: false, error: `Unknown action: ${message.action}` };
  }
}

// ------------------------------------------------------------------
// Highlight-to-Explain: keyboard shortcut listener
// ------------------------------------------------------------------
// Ctrl+Shift+E / Cmd+Shift+E declared in manifest.json → chrome.commands.
// content-script.js is only injected on-demand (no persistent content_scripts
// entry), so we must (re-)inject it here before messaging — injection is safe
// to repeat because the highlight listener guards itself against duplicate
// registration, and we deliberately do NOT set __growCareerExtractMode here,
// so the existing bookmark-extraction IIFE at the top of content-script.js
// stays a no-op (see the guard added there) instead of silently auto-saving
// a bookmark the first time a user highlights text on a page.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'explain-selection') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    return; // cannot inject into restricted pages
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content-script.js'],
    });
    await chrome.tabs.sendMessage(tab.id, { action: 'show-explain-popup' });
  } catch (err) {
    console.error('[background] Failed to trigger explain popup:', err);
  }
});

// ------------------------------------------------------------------
// Highlight-to-Explain: Edge Function + flashcard proxy
// ------------------------------------------------------------------
// content-script.js runs in the page's isolated world (classic script, no ES
// modules, arbitrary page CSP) — it cannot safely import supabase-js itself.
// Same pattern as save-bookmark: content-script proxies through background.js,
// which is the only place holding the Supabase client.
async function handleExplainKeyword(keyword, context) {
  const { data, error } = await supabase.functions.invoke('explain-keyword', {
    body: { keyword, context },
  });

  if (error || !data?.success) {
    return { success: false, error: error?.message || data?.error || 'Không thể giải thích từ khóa' };
  }

  return {
    success: true,
    data: { explanation: data.explanation, category: data.category, difficulty: data.difficulty },
  };
}

async function handleSaveFlashcard({ keyword, explanation, source_url }) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return { success: false, error: 'Not authenticated' };
  }

  const { error } = await supabase.from('flashcards').insert({
    user_id: session.user.id,
    keyword,
    explanation,
    source_url,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ------------------------------------------------------------------
// Auth handlers
// ------------------------------------------------------------------
async function handleGetSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) return { success: false, error: error.message };
  return { success: true, session };
}

async function handleSignIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, error: error.message };
  return { success: true, user: data.user, session: data.session };
}

async function handleSignUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { success: false, error: error.message };
  return { success: true, user: data.user, session: data.session };
}

async function handleSignOut() {
  const { error } = await supabase.auth.signOut();
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ------------------------------------------------------------------
// Save bookmark flow
// ------------------------------------------------------------------

// Step 1: Popup asks to save → inject content-script into active tab
async function handleSaveBookmark() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) return { success: false, error: 'Sign in before saving a page.' };
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.id) {
    return { success: false, error: 'No active tab found' };
  }

  // Guard: cannot inject into chrome:// or extension pages
  if (!tab.url || !/^https?:\/\//.test(tab.url)) {
    return { success: false, error: 'Cannot save this type of page' };
  }

  try {
    // Flip the extract-mode flag before injecting — content-script.js's
    // top-level extraction IIFE checks this so it only ever runs for an
    // actual Save click, never as a side effect of the highlight-to-explain
    // command re-injecting the same file just to register its listener.
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => { window.__growCareerExtractMode = true; },
    });

    // Inject and execute content-script in the active tab
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content-script.js'],
    });

    // content-script will send 'page-content' message back asynchronously.
    // We optimistically return pending and let handlePageContent do the INSERT.
    return { success: true, status: 'extracting' };
  } catch (err) {
    console.error('[background] Failed to inject content-script:', err);
    return { success: false, error: 'Failed to read page content: ' + err.message };
  }
}

// Step 2: Receive extracted content from content-script, INSERT into Supabase
async function handlePageContent(message, sender) {
  const { title, text } = message;
  const tab = sender.tab;

  if (!tab) {
    console.error('[background] handlePageContent: no sender tab');
    return { success: false, error: 'No sender tab' };
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    console.error('[background] No session when saving bookmark');
    // Notify popup that save failed (user was logged out)
    chrome.runtime.sendMessage({ action: 'bookmark-result', success: false, error: 'Not authenticated' }).catch(() => {});
    return { success: false, error: 'Not authenticated' };
  }

  const url = tab.url;
  const pageTitle = title || tab.title || url;
  const rawText = text || '';
  const userId = session.user.id;

  console.log(`[background] Inserting bookmark: ${pageTitle} | ${url}`);

  const { data, error } = await supabase.from('bookmarks').insert({
    user_id: userId,
    url: url,
    title: pageTitle,
    raw_text: rawText.slice(0, 50000), // Cap at 50 000 chars to stay within Supabase row limits
    status: 'pending',
  }).select().single();

  if (error) {
    console.error('[background] Insert error:', error);
    // Notify popup
    chrome.runtime.sendMessage({ action: 'bookmark-result', success: false, error: error.message }).catch(() => {});
    return { success: false, error: error.message };
  }

  console.log('[background] Bookmark saved, id:', data.id, '— AI pipeline will run automatically');
  // Notify popup of success
  chrome.runtime.sendMessage({ action: 'bookmark-result', success: true, bookmark: data }).catch(() => {});
  return { success: true, bookmark: data };
}
