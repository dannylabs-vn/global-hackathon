import React, { useState } from 'react';
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
export function App() {
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
