// popup.js
// Logic for popup.html — the extension's main UI.
//
// Responsibilities:
//   1. On open: check session via background.js → show correct view (auth or main)
//   2. Auth view: handle sign-in / sign-up form submission
//   3. Main view: show current tab title, handle "Save This Page" click
//   4. Listen for bookmark-result messages from background.js to update status UI
//
// Communication:
//   → background.js via chrome.runtime.sendMessage (all Supabase calls go through background)
//   ← background.js via chrome.runtime.onMessage (bookmark-result)

// ----------------------------------------------------------------
// DOM references
// ----------------------------------------------------------------
const viewLoading    = document.getElementById('view-loading');
const viewAuth       = document.getElementById('view-auth');
const viewMain       = document.getElementById('view-main');

const tabSignin      = document.getElementById('tab-signin');
const tabSignup      = document.getElementById('tab-signup');
const formSignin     = document.getElementById('form-signin');
const formSignup     = document.getElementById('form-signup');

const signinEmail    = document.getElementById('signin-email');
const signinPassword = document.getElementById('signin-password');
const signinError    = document.getElementById('signin-error');
const btnSignin      = document.getElementById('btn-signin');

const signupEmail    = document.getElementById('signup-email');
const signupPassword = document.getElementById('signup-password');
const signupError    = document.getElementById('signup-error');
const signupSuccess  = document.getElementById('signup-success');
const btnSignup      = document.getElementById('btn-signup');

const btnSignout     = document.getElementById('btn-signout');
const userEmailEl    = document.getElementById('user-email');
const currentPageTitle = document.getElementById('current-page-title');

const btnSave        = document.getElementById('btn-save');

const statusSuccess  = document.getElementById('status-success');
const statusError    = document.getElementById('status-error');
const statusErrorMsg = document.getElementById('status-error-msg');
const statusExtracting = document.getElementById('status-extracting');

// ----------------------------------------------------------------
// Helper: send a message to background.js
// ----------------------------------------------------------------
function sendToBackground(message) {
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

// ----------------------------------------------------------------
// View helpers
// ----------------------------------------------------------------
function showView(viewEl) {
  [viewLoading, viewAuth, viewMain].forEach((v) => v.classList.add('hidden'));
  viewEl.classList.remove('hidden');
}

function setAuthLoading(btnEl, loading) {
  const label = btnEl.querySelector('.btn-label');
  const spinner = btnEl.querySelector('.btn-spinner');
  btnEl.disabled = loading;
  label.classList.toggle('hidden', loading);
  spinner.classList.toggle('hidden', !loading);
}

function hideAllStatus() {
  statusSuccess.classList.add('hidden');
  statusError.classList.add('hidden');
  statusExtracting.classList.add('hidden');
}

function showStatus(type, errorText = '') {
  hideAllStatus();
  if (type === 'success')    statusSuccess.classList.remove('hidden');
  if (type === 'error')    { statusError.classList.remove('hidden'); statusErrorMsg.textContent = errorText; }
  if (type === 'extracting') statusExtracting.classList.remove('hidden');
}

// ----------------------------------------------------------------
// Init: check session on popup open
// ----------------------------------------------------------------
async function init() {
  showView(viewLoading);

  const res = await sendToBackground({ action: 'get-session' });

  if (res.success && res.session) {
    await enterMainView(res.session);
  } else {
    showView(viewAuth);
  }
}

async function enterMainView(session) {
  if (session?.user?.email) {
    userEmailEl.textContent = session.user.email;
  }

  // Show current tab title
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.title) currentPageTitle.textContent = tab.title;
    if (tab?.url) {
      const isRestricted = tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://');
      if (isRestricted) {
        btnSave.disabled = true;
        btnSave.title = 'Không thể lưu trang này';
        currentPageTitle.textContent = 'Trang hệ thống (không thể lưu)';
      }
    }
  } catch (_) {}

  btnSignout.classList.remove('hidden');
  showView(viewMain);
}

// ----------------------------------------------------------------
// Tab switching (sign-in / sign-up)
// ----------------------------------------------------------------
function switchTab(tabName) {
  const isSignin = tabName === 'signin';

  tabSignin.classList.toggle('active', isSignin);
  tabSignup.classList.toggle('active', !isSignin);

  formSignin.classList.toggle('hidden', !isSignin);
  formSignup.classList.toggle('hidden', isSignin);

  // Clear errors
  signinError.classList.add('hidden');
  signupError.classList.add('hidden');
  signupSuccess.classList.add('hidden');
}

tabSignin.addEventListener('click', () => switchTab('signin'));
tabSignup.addEventListener('click', () => switchTab('signup'));

// ----------------------------------------------------------------
// Sign-in
// ----------------------------------------------------------------
formSignin.addEventListener('submit', async (e) => {
  e.preventDefault();
  signinError.classList.add('hidden');
  setAuthLoading(btnSignin, true);

  const res = await sendToBackground({
    action: 'sign-in',
    email: signinEmail.value.trim(),
    password: signinPassword.value,
  });

  setAuthLoading(btnSignin, false);

  if (res.success) {
    await enterMainView(res.session);
  } else {
    signinError.textContent = res.error || 'Đăng nhập thất bại';
    signinError.classList.remove('hidden');
  }
});

// ----------------------------------------------------------------
// Sign-up
// ----------------------------------------------------------------
formSignup.addEventListener('submit', async (e) => {
  e.preventDefault();
  signupError.classList.add('hidden');
  signupSuccess.classList.add('hidden');
  setAuthLoading(btnSignup, true);

  const res = await sendToBackground({
    action: 'sign-up',
    email: signupEmail.value.trim(),
    password: signupPassword.value,
  });

  setAuthLoading(btnSignup, false);

  if (res.success) {
    if (res.session) {
      // Auto-confirmed (email confirmation disabled in Supabase settings)
      await enterMainView(res.session);
    } else {
      // Email confirmation required
      signupSuccess.classList.remove('hidden');
    }
  } else {
    signupError.textContent = res.error || 'Đăng ký thất bại';
    signupError.classList.remove('hidden');
  }
});

// ----------------------------------------------------------------
// Sign-out
// ----------------------------------------------------------------
btnSignout.addEventListener('click', async () => {
  await sendToBackground({ action: 'sign-out' });
  btnSignout.classList.add('hidden');
  signinEmail.value = '';
  signinPassword.value = '';
  switchTab('signin');
  showView(viewAuth);
});

// ----------------------------------------------------------------
// Save This Page
// ----------------------------------------------------------------
btnSave.addEventListener('click', async () => {
  if (btnSave.disabled) return;

  hideAllStatus();
  btnSave.disabled = true;
  const btnLabel = btnSave.querySelector('.btn-label');
  const btnSpinner = btnSave.querySelector('.btn-spinner');
  btnLabel.classList.add('hidden');
  btnSpinner.classList.remove('hidden');

  showStatus('extracting');

  const res = await sendToBackground({ action: 'save-bookmark' });

  if (!res.success) {
    // Injection or immediate error
    showStatus('error', res.error || 'Không thể lưu trang này');
    resetSaveButton();
  }
  // If res.success + status === 'extracting', we wait for 'bookmark-result' message from background
  // Success/error will be shown via the onMessage listener below
});

function resetSaveButton() {
  btnSave.disabled = false;
  const btnLabel = btnSave.querySelector('.btn-label');
  const btnSpinner = btnSave.querySelector('.btn-spinner');
  btnLabel.classList.remove('hidden');
  btnSpinner.classList.add('hidden');
}

// ----------------------------------------------------------------
// Listen for bookmark-result from background.js
// ----------------------------------------------------------------
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'bookmark-result') {
    resetSaveButton();
    if (message.success) {
      showStatus('success');
    } else {
      showStatus('error', message.error || 'Lưu thất bại');
    }
  }
});

// ----------------------------------------------------------------
// Start
// ----------------------------------------------------------------
init();
