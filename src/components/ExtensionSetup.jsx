import React, { useState } from 'react';
import './SkillWorkspace.css';
import './ExtensionSetup.css';

export function ExtensionSetup() {
  const [notice, setNotice] = useState('');
  const website = window.location.origin;
  async function copy(value) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice('Copied. Paste it into the next step.');
    } catch {
      setNotice('Select and copy the address shown below.');
    }
  }
  return <main className="sw-app es-page">
    <div className="es-content">
      <a href="/" className="site-brand"><span className="brand-skill">Skill</span><span className="brand-mark">mark.</span></a>
      <header className="sw-heading"><div>
        <p className="sw-eyebrow">YOUR BROWSER. YOUR LEARNING SPACE.</p>
        <h1>Set up Skillmark<span>.</span></h1>
        <p>Save pages and explanations as you browse, then find them in your workspace.</p>
      </div></header>
      <p>The current preview installs from a downloaded folder. Chrome asks you to load it once.</p>
      <ol className="es-steps">
        <li className="sw-panel"><h2>Download and extract</h2>
          <p>Download the extension, right-click the ZIP, and choose <strong>Extract All</strong>. Keep the extracted folder on your computer.</p>
          <a className="sw-button" href="/downloads/skillmark-extension.zip" download="skillmark-extension.zip">Download Skillmark</a>
        </li>
        <li className="sw-panel"><h2>Add it to Chrome</h2>
          <p>Open the address below in a new tab, enable <strong>Developer mode</strong>, and select <strong>Load unpacked</strong>. Choose the extracted folder containing <code>manifest.json</code>.</p>
          <div className="es-copy"><code>chrome://extensions</code><button className="sw-button secondary" onClick={() => copy('chrome://extensions')}>Copy address</button></div>
          <p className="sw-small">Using Edge? Open <code>edge://extensions</code> instead. Already installed? Click Reload on the Skillmark card and refresh your article tab.</p>
        </li>
        <li className="sw-panel"><h2>Connect your workspace</h2>
          <p>Pin Skillmark from the browser’s Extensions menu. Open its popup, choose <strong>Settings</strong>, and save this website address:</p>
          <div className="es-copy"><code>{website}</code><button className="sw-button secondary" onClick={() => copy(website)}>Copy website address</button></div>
          <p>Sign in to the extension with the <strong>same email and account</strong> you use on this website. Each keeps its own sign-in session.</p>
        </li>
        <li className="sw-panel"><h2>Save your first page</h2>
          <p>Open an article, click Skillmark, and choose <strong>Save This Page</strong>. Wait for the saved message, then choose <strong>Open workspace</strong> to see your bookmark.</p>
          <p>To save an explanation, select a word and press <strong>Ctrl+Shift+E</strong> on Windows or <strong>Command+Shift+E</strong> on Mac, then save the flashcard.</p>
          <p className="sw-small">Use a normal website to test. Browser settings and the Chrome Web Store cannot be saved.</p>
        </li>
      </ol>
      {notice && <p className="sw-notice" role="status">{notice}</p>}
      <div className="sw-actions"><a className="sw-button" href="/learn#highlights">Open my bookmarks</a><a className="sw-link" href="/">Back to website</a></div>
    </div>
  </main>;
}
