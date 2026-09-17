import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { zipSync } from 'fflate';
import { storeWebsiteUrl } from './store-config.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const storeBuild = process.argv.includes('--store');
const website = storeBuild ? storeWebsiteUrl(process.env.SKILLMARK_WEBSITE_URL) : null;
await build({ configFile: false, root, publicDir: false, build: { outDir: 'extension', emptyOutDir: false, minify: true, lib: { entry: 'extension/background.js', formats: ['es'], fileName: () => 'background.bundle.js' }, rolldownOptions: { output: { codeSplitting: false } } } });

// Ship only runtime files, with manifest.json at the root of the ZIP.
const files = ['manifest.json', 'background.bundle.js', 'content-script.js',
  'popup.html', 'popup.js', 'options.html', 'options.js', 'website.js', 'runtime-config.js', 'styles/popup.css', 'icons/icon.png'];
const entries = {};
for (const file of files) entries[file] = new Uint8Array(await readFile(resolve(root, 'extension', file)));
if (storeBuild) {
  entries['runtime-config.js'] = new TextEncoder().encode(`export const DEFAULT_WEBSITE_URL = ${JSON.stringify(website)};\n`);
  const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
  manifest.homepage_url = website;
  entries['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
}
const archive = zipSync(entries, { level: 6 });
for (const directory of storeBuild ? ['artifacts'] : ['public/downloads', 'artifacts']) {
  await mkdir(resolve(root, directory), { recursive: true });
  await writeFile(resolve(root, directory, storeBuild ? 'skillmark-chrome-store.zip' : 'skillmark-extension.zip'), archive);
}
console.log(storeBuild ? 'Store package ready: artifacts/skillmark-chrome-store.zip' : 'Extension download ready: public/downloads/skillmark-extension.zip');
