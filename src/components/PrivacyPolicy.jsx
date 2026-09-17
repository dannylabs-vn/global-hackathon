import React from 'react';
import './SkillWorkspace.css';
import './ExtensionSetup.css';

export function PrivacyPolicy() {
  return <main className="sw-app es-page"><article className="es-content">
    <a href="/" className="site-brand"><span className="brand-skill">Skill</span><span className="brand-mark">mark.</span></a>
    <h1>Skillmark privacy policy</h1>
    <p>Updated September 17, 2026</p>
    <p>Skillmark helps you save reading material, explain selected terms, and explore learning and career directions. This policy covers the Skillmark extension and learning workspace.</p>
    <h2>Information used by Skillmark</h2>
    <ul>
      <li><strong>Account information:</strong> your email and authentication credentials are sent to Supabase Authentication when you register or sign in. Session tokens are kept in browser storage to keep you signed in.</li>
      <li><strong>Pages you save:</strong> when you choose Save This Page, Skillmark sends the page URL, title, and extracted text (up to 50,000 characters), associated with your account, to its cloud backend.</li>
      <li><strong>Terms you explain:</strong> invoking the explanation shortcut sends your selected text and nearby context (up to 2,000 characters) to the backend to generate an explanation. Saving a flashcard stores the term, explanation, and source URL in your account.</li>
      <li><strong>Learning results:</strong> bookmark summaries, topics, flashcards, and career reports are used to display your learning workspace.</li>
    </ul>
    <h2>When content is accessed</h2>
    <p>The extension accesses page content when you choose to save a page or invoke the explanation shortcut. It does not request browser-history access or automatically collect every page you visit. Choose carefully before saving private or sensitive page content.</p>
    <h2>Cloud processing and storage</h2>
    <p>Skillmark uses Supabase for authentication, database storage, and backend functions. Selected page content and text are sent over HTTPS for server-side analysis and explanation generation. These features are not entirely on-device. Generated results can be inaccurate.</p>
    <p>Collected information is used to provide authentication, saved reading, explanations, synchronization, and learning reports. It is not used by Skillmark for advertising or sold to advertisers. Service providers process information as needed to operate these features.</p>
    <h2>Your choices and deletion</h2>
    <p>You can remove saved bookmarks from the workspace and stop further extension access by disabling or uninstalling it. Signing out or uninstalling the extension does not delete records already stored in your account. To request account or other stored-data deletion, contact the support address below from your account email. Do not email your password.</p>
    <h2>Contact</h2>
    <p>For questions, support, or data requests: <a href="mailto:dannyhong2310@gmail.com">dannyhong2310@gmail.com</a>.</p>
    <a className="sw-link" href="/">Back to Skillmark</a>
  </article></main>;
}
