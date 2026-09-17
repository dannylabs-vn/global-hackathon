import { getWebsiteUrl, normalizeWebsiteUrl } from './website.js';
const input = document.getElementById('website');
const status = document.getElementById('status');
try { input.value = await getWebsiteUrl(); }
catch (error) { status.textContent = error.message; }
document.getElementById('settings').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const websiteUrl = normalizeWebsiteUrl(input.value);
    await chrome.storage.local.set({ websiteUrl });
    status.textContent = 'Website connection saved.';
  } catch (error) { status.textContent = error.message; }
});
