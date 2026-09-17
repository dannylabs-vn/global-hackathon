import React, { useEffect, useState } from 'react';
import { InteractiveDemo } from './components/InteractiveDemo.jsx';
import { useReveal } from './useReveal.js';
import { useInteractionMotion } from './useInteractionMotion.js';
import { Navigation } from './components/Navigation.jsx';
import { Hero } from './components/Hero.jsx';
import { ProductPreview } from './components/ProductPreview.jsx';
import { Features } from './components/Features.jsx';
import { LearningLoop } from './components/LearningLoop.jsx';
import { SkillMap } from './components/SkillMap.jsx';
import { Privacy } from './components/Privacy.jsx';
import { Footer } from './components/Footer.jsx';
import { SkillWorkspace } from './components/SkillWorkspace.jsx';
import { Auth } from './components/Auth.jsx';
import { ExtensionSetup } from './components/ExtensionSetup.jsx';
import { PrivacyPolicy } from './components/PrivacyPolicy.jsx';
import { getSession, onAuthChange } from './lib/auth.js';

export function App() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
  useEffect(() => {
    let active = true;
    getSession().then(current => { if (active) setSession(current); });
    const { data: listener } = onAuthChange(current => setSession(current));
    return () => { active = false; listener?.subscription?.unsubscribe(); };
  }, []);

  const path = window.location.pathname;

  if (path === '/extension') return <ExtensionSetup />;
  if (path === '/privacy') return <PrivacyPolicy />;

  if (path === '/login') {
    if (session === undefined) return null;
    if (session) { window.location.href = '/learn'; return null; }
    return <Auth onAuthenticated={() => { window.location.href = '/learn'; }} />;
  }

  if (path.startsWith('/learn')) {
    if (session === undefined) return null;
    if (!session) return <Auth onAuthenticated={() => {}} />;
    return <SkillWorkspace />;
  }

  return <LandingApp />;
}
function LandingApp() {
  useReveal();
  useInteractionMotion();
  const [demo, setDemo] = useState(null);
  function handleInteraction(event) {
    const trigger = event.target.closest('[data-demo-skill], [data-pencil-name="Secondary CTA"]');
    if (!trigger) return;
    event.preventDefault();
    setDemo({ skill: trigger.dataset.demoSkill || null });
  }
  return <><div className="reading-progress" aria-hidden="true" /><main data-pencil-name="2. Landing" onClick={handleInteraction}><Navigation /><Hero /><ProductPreview /><Features /><LearningLoop /><SkillMap /><Privacy /><Footer onDemo={() => setDemo({ skill: null })} /></main>{demo && <InteractiveDemo initialSkill={demo.skill} onClose={() => setDemo(null)} />}</>;
}
