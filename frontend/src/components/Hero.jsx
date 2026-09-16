import React from 'react';

export function Hero() {
  return (
    <section id="hero" data-pencil-name="2. Hero" className="edtech-hero">
      <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
      <div className="hero-orbit hero-orbit-two" aria-hidden="true" />
      <div className="hero-eyebrow"><span /> For students navigating the AI era</div>
      <h1>Turn scattered reading<br />into a skill plan that's<br className="mobile-break" /> <span className="hero-highlight">actually you.</span></h1>
      <p className="hero-description">Highlight anything while you browse. Skillmark explains it, labels the skill behind it, and quietly builds your Skill Gap Map — turning hours of scrolling into a learning path you can follow.</p>
      <div className="hero-actions">
        <a href="#get-started" className="theme-button theme-button-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 4H4v6h2a2 2 0 1 1 0 4H4v6h6v-2a2 2 0 1 1 4 0v2h6v-6h-2a2 2 0 1 1 0-4h2V4h-6V2a2 2 0 1 0-4 0v2H8Z" /></svg>
          Add Skillmark to Chrome — free
        </a>
        <button type="button" data-pencil-name="Secondary CTA" className="theme-button theme-button-secondary"><span className="play-icon" aria-hidden="true">▶</span> Watch it work</button>
      </div>
      <p className="hero-trust"><span aria-hidden="true">✓</span> Free <span>·</span> 2-minute setup <span>·</span> Works on every site <span>·</span> Local-first</p>
      <div className="learning-sticker sticker-left" aria-hidden="true"><span className="sticker-icon">✦</span><div><strong>Follow your curiosity</strong><small>Every highlight is a start.</small></div></div>
      <div className="learning-sticker sticker-right" aria-hidden="true"><span className="sticker-icon">↗</span><div><strong>Build your next skill</strong><small>A little progress, every day.</small></div></div>
    </section>
  );
}
