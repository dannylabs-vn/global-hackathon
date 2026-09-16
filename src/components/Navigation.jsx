import React from 'react';

export function Navigation() {
  return (
    <header id="top" data-pencil-name="2. Nav" className="site-nav">
      <a href="#hero" className="site-brand" aria-label="Skillmark home"><span className="brand-skill">Skill</span><span className="brand-mark">mark.</span></a>
      <nav aria-label="Main navigation" data-pencil-name="Nav Right">
        <a href="#how-it-works">How it works</a>
        <a href="#roadmap" data-pencil-name="Roadmap">Roadmap</a>
        <a href="#privacy" className="nav-privacy">Privacy</a>
        <a href="#get-started" className="nav-install">Add to Chrome <span aria-hidden="true">↗</span></a>
      </nav>
    </header>
  );
}
