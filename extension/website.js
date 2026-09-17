import { DEFAULT_WEBSITE_URL } from './runtime-config.js';

export function normalizeWebsiteUrl(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Enter an HTTP or HTTPS website address without login details.');
  }
  return url.origin;
}

export async function getWebsiteUrl() {
  const { websiteUrl } = await chrome.storage.local.get('websiteUrl');
  return normalizeWebsiteUrl(websiteUrl || DEFAULT_WEBSITE_URL);
}
