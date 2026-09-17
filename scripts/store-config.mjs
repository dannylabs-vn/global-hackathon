export function storeWebsiteUrl(value) {
  if (!value) throw new Error('Set SKILLMARK_WEBSITE_URL to the public HTTPS website before building for the store.');
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
    hostname === 'localhost' || hostname.endsWith('.localhost') || !hostname.includes('.') ||
    /^[\d.]+$/.test(hostname) || hostname.includes(':') ||
    hostname.endsWith('.local') || hostname.endsWith('.test') || hostname.endsWith('.invalid') ||
    hostname === 'example.com' || hostname.endsWith('.example.com') ||
    url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SKILLMARK_WEBSITE_URL must be a public HTTPS origin, without a path, port, credentials, or query.');
  }
  return url.origin;
}
