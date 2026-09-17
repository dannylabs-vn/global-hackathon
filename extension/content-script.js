// Injected only on an explicit Save or Explain action. No remotely loaded code.
(async function extractPageContent() {
  if (!window.__growCareerExtractMode) return;
  // Consume this click immediately; the next explicit click can retry.
  window.__growCareerExtractMode = false;
  await chrome.runtime.sendMessage({
    action: 'page-content',
    title: document.title,
    text: getFallbackText().trim(),
  });
})();

// ------------------------------------------------------------------
// Fallback extraction
// ------------------------------------------------------------------
function getFallbackText() {
  // Remove script and style elements from a clone, then get innerText
  const clone = document.body.cloneNode(true);

  // Remove non-content elements
  const junkSelectors = ['script', 'style', 'noscript', 'iframe', 'nav', 'footer', 'header', 'aside', '.ad', '.ads', '[role="banner"]', '[role="navigation"]'];
  junkSelectors.forEach((sel) => {
    try {
      clone.querySelectorAll(sel).forEach((el) => el.remove());
    } catch (_) {}
  });

  return clone.innerText || document.body.innerText || '';
}

// ====================================================================
// Highlight-to-Explain (Ctrl+Shift+E / Cmd+Shift+E)
// ====================================================================
// Does NOT touch the bookmark-extraction logic above. Triggered by
// background.js in response to the "explain-selection" command:
//   1. User highlights text on any page, presses the shortcut
//   2. background.js (re-)injects this file, then sends 'show-explain-popup'
//   3. We read window.getSelection(), pull nearby context, and render a
//      small popup (Shadow DOM — isolates CSS from whatever page we're on)
//      near the highlighted text
//   4. Popup calls Edge Function explain-keyword (proxied via background.js,
//      same reasoning as the bookmark flow: this file runs in the page's
//      isolated world with the page's own CSP, so it cannot safely import
//      supabase-js directly — background.js is the only place holding that
//      client)
//   5. "Save to flashcard" proxies an INSERT into `flashcards` via background.js
//
// Wrapped in this guard so re-injecting content-script.js (which happens
// every time the shortcut fires, since this file isn't a persistent
// content_scripts entry) never registers duplicate listeners.
if (!window.__growCareerHighlightReady) {
  window.__growCareerHighlightReady = true;

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'show-explain-popup') {
      handleShowExplainPopup();
    }
  });

  // Click outside the popup closes it. Registered once; checks the host
  // fresh on every click since the popup is created/destroyed dynamically.
  document.addEventListener('click', (e) => {
    const host = document.getElementById('grow-career-popup-host');
    if (host && !host.contains(e.target)) {
      host.remove();
    }
  });

  function handleShowExplainPopup() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (!selectedText) return; // không có gì được highlight, bỏ qua

    const context = getSurroundingContext(selection);
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    showExplainPopup(selectedText, context, rect);
  }

  function getSurroundingContext(selection) {
    const node = selection.anchorNode;
    const parentText = node?.parentElement?.innerText || '';
    return parentText.slice(0, 2000); // giới hạn độ dài gửi lên AI
  }

  // --------------------------------------------------------------
  // Popup UI — Shadow DOM
  // --------------------------------------------------------------
  function showExplainPopup(keyword, context, rect) {
    // Xóa popup cũ nếu có
    const existing = document.getElementById('grow-career-popup-host');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'grow-career-popup-host';
    host.style.position = 'absolute';
    host.style.top = `${window.scrollY + rect.bottom + 8}px`;
    host.style.left = `${window.scrollX + rect.left}px`;
    host.style.zIndex = '999999';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
      <style>${GC_POPUP_STYLES}</style>
      <div class="gc-popup">
        <div class="gc-popup-header">
          <span class="gc-popup-keyword">${escapeHtml(keyword)}</span>
          <button class="gc-popup-close">&times;</button>
        </div>
        <div class="gc-popup-body loading">
          <div class="gc-spinner"></div>
          <span class="text-muted">Đang giải thích...</span>
        </div>
        <div class="gc-popup-actions hidden">
          <button class="gc-btn-save">Save to flashcard</button>
        </div>
      </div>
    `;

    shadow.querySelector('.gc-popup-close').onclick = () => host.remove();

    callExplainKeyword(keyword, context, shadow, host);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // --------------------------------------------------------------
  // Call Edge Function (via background.js) + wire up "Save to flashcard"
  // --------------------------------------------------------------
  async function callExplainKeyword(keyword, context, shadow, host) {
    const body = shadow.querySelector('.gc-popup-body');
    const actions = shadow.querySelector('.gc-popup-actions');

    const res = await sendToBackgroundGC({ action: 'explain-keyword', keyword, context });

    body.classList.remove('loading');

    if (!res.success) {
      body.innerHTML = `<span style="color:#e11d48;font-size:13px;">Không thể giải thích. Thử lại sau.</span>`;
      return;
    }

    const { explanation, category, difficulty } = res.data;

    body.innerHTML = `
      <div class="gc-explanation">${escapeHtml(explanation)}</div>
      <div class="gc-meta">
        <span class="gc-badge">${escapeHtml(category)}</span>
        <span class="gc-badge">${escapeHtml(difficulty)}</span>
      </div>
    `;
    actions.classList.remove('hidden');

    const saveBtn = shadow.querySelector('.gc-btn-save');
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Đang lưu...';

      const saveRes = await sendToBackgroundGC({
        action: 'save-flashcard',
        keyword,
        explanation,
        source_url: window.location.href,
      });

      if (!saveRes.success) {
        saveBtn.textContent = saveRes.error === 'Not authenticated' ? 'Vui lòng đăng nhập trước' : 'Lỗi, thử lại';
        saveBtn.disabled = false;
      } else {
        saveBtn.textContent = '✓ Đã lưu';
        saveBtn.classList.add('saved');
        setTimeout(() => host.remove(), 1500);
      }
    };
  }

  function sendToBackgroundGC(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { success: false, error: 'No response from background' });
        }
      });
    });
  }

  // --------------------------------------------------------------
  // CSS — reuses the same design tokens as popup.css (Modern Organic
  // Light / Mint Paper theme) so both UIs look like one product.
  // --------------------------------------------------------------
  const GC_POPUP_STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    :host {
      all: initial; /* reset hoàn toàn, tránh kế thừa style từ trang web */
    }

    .gc-popup {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      width: 300px;
      background: #fbfcf7;
      border: 1px solid #dbe7de;
      border-radius: 16px;
      box-shadow: 0 8px 28px rgba(8, 127, 112, 0.2);
      overflow: hidden;
      animation: gc-slideIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes gc-slideIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .gc-popup-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: linear-gradient(180deg, #ffffff 0%, #fbfcf7 100%);
      border-bottom: 1px solid #dbe7de;
    }

    .gc-popup-keyword {
      font-size: 14px;
      font-weight: 700;
      color: #123c36;
      letter-spacing: -0.2px;
    }

    .gc-popup-close {
      background: transparent;
      border: none;
      color: #5c706a;
      font-size: 18px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }

    .gc-popup-close:hover {
      color: #e11d48;
    }

    .gc-popup-body {
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 40px;
    }

    .gc-popup-body.loading {
      align-items: center;
      flex-direction: row;
    }

    .gc-explanation {
      font-size: 13px;
      color: #123c36;
      line-height: 1.5;
    }

    .gc-meta {
      display: flex;
      gap: 6px;
      margin-top: 4px;
    }

    .gc-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 8px;
      background: #e7f5ed;
      color: #075b51;
      border: 1px solid #dbe7de;
    }

    .text-muted {
      font-size: 13px;
      color: #80948e;
    }

    .gc-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #dbe7de;
      border-top-color: #087f70;
      border-radius: 50%;
      animation: gc-spin 0.7s linear infinite;
    }

    @keyframes gc-spin {
      to { transform: rotate(360deg); }
    }

    .gc-popup-actions {
      padding: 0 14px 14px;
    }

    .gc-popup-actions.hidden {
      display: none;
    }

    .gc-btn-save {
      width: 100%;
      padding: 10px 16px;
      background: #087f70;
      color: white;
      border: none;
      border-radius: 12px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.2s;
    }

    .gc-btn-save:hover:not(:disabled) {
      background: #075b51;
      transform: translateY(-1px);
    }

    .gc-btn-save:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .gc-btn-save.saved {
      background: #10b981;
    }
  `;
}
