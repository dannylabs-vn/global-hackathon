import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { unzipSync } from 'fflate';
import { storeWebsiteUrl } from './store-config.mjs';
import { normalizeWebsiteUrl } from '../extension/website.js';

test('each explicit Save click extracts content, including a retry on the same page', async () => {
  const source = await readFile('extension/content-script.js', 'utf8');
  const messages = [];
  const text = 'Vietnamese text: Tiếng Việt — giải thích từ khóa. '.repeat(10);
  const context = vm.createContext({
    window: {}, console: { warn() {} },
    fetch: async () => { throw new Error('Remote scripts blocked by MV3'); },
    document: { title: 'Example', addEventListener() {}, body: {
      innerText: text, cloneNode: () => ({ querySelectorAll: () => [], innerText: text }),
    } },
    chrome: { runtime: { onMessage: { addListener() {} }, sendMessage: async message => { messages.push(message); } } },
  });
  for (let click = 0; click < 2; click++) {
    context.window.__growCareerExtractMode = true;
    vm.runInContext(source, context);
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.equal(messages.length, 2, 'A second save must finish rather than leave the popup extracting forever');
  assert.equal(messages[1].text, text.trim());
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(messages.length, 2, 'Highlight injection must not save an unrequested bookmark');
});

test('packaged service worker starts without DOM APIs and answers session requests', async () => {
  let listener;
  const noop = () => {};
  const context = vm.createContext({
    console, URL, URLSearchParams, Headers, Request, Response, fetch, AbortController, WebSocket,
    TextEncoder, TextDecoder, atob, btoa, crypto: globalThis.crypto,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop,
    chrome: { runtime: { onMessage: { addListener: fn => { listener = fn; } } },
      commands: { onCommand: { addListener: noop } },
      storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } } },
  });
  vm.runInContext(await readFile('extension/background.bundle.js', 'utf8'), context);
  assert.equal(typeof listener, 'function');
  const response = await new Promise(resolve => listener({ action: 'get-session' }, {}, resolve));
  assert.equal(response.success, true);
  assert.equal(response.session, null);
});

test('extension package references existing files and uses no remotely executed scripts', async () => {
  const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
  for (const file of [manifest.background.service_worker, manifest.action.default_popup,
    manifest.options_page, ...Object.values(manifest.icons)]) {
    assert.ok((await readFile(`extension/${file}`)).length > 0, file);
  }
  for (const file of [manifest.background.service_worker, 'content-script.js', 'popup.js', 'options.js']) {
    const source = await readFile(`extension/${file}`, 'utf8');
    assert.doesNotMatch(source, /(?:from\s*|import\s*\()['"]https?:\/\//);
    assert.doesNotMatch(source, /new Function\s*\(|\beval\s*\(/);
  }
});

test('website download contains the current installable extension', async () => {
  const archive = unzipSync(new Uint8Array(await readFile('public/downloads/skillmark-extension.zip')));
  const manifest = JSON.parse(new TextDecoder().decode(archive['manifest.json']));
  for (const file of [manifest.background.service_worker, manifest.action.default_popup,
    manifest.options_page, 'content-script.js', 'popup.js', 'options.js', 'website.js', 'runtime-config.js', 'styles/popup.css', ...Object.values(manifest.icons)]) {
    assert.deepEqual(Buffer.from(archive[file] || []), await readFile(`extension/${file}`), `${file} must be current`);
  }
});

test('store releases cannot accidentally send customers to localhost or a placeholder', () => {
  for (const value of [undefined, 'http://localhost:5173', 'https://127.0.0.1', 'https://localhost',
    'https://example.com', 'https://app.local', 'https://user:pass@skillmark.dev', 'https://skillmark.dev/path']) {
    assert.throws(() => storeWebsiteUrl(value));
  }
  assert.equal(storeWebsiteUrl('https://skillmark-dannylabs.hushed-prawn-8015.chatgpt.site/'),
    'https://skillmark-dannylabs.hushed-prawn-8015.chatgpt.site');
  assert.equal(normalizeWebsiteUrl('https://skillmark.dev/learn'), 'https://skillmark.dev');
  assert.throws(() => normalizeWebsiteUrl('javascript:alert(1)'));
});
