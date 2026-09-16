import React, { useEffect, useRef, useState } from 'react';

const skills = ['Agentic workflows', 'Prompt design', 'System design', 'Data storytelling', 'ML fundamentals'];
const lessons = {
  'Agentic workflows': 'Break a task into steps, give each agent a clear role, and verify the result before moving on.',
  'Prompt design': 'Give the model a goal, relevant context, constraints, and an example of the output you want.',
  'System design': 'Start with requirements, identify the components, and explain how data moves between them.',
  'Data storytelling': 'Choose one takeaway, use a chart that supports it, and explain why it matters.',
  'ML fundamentals': 'Separate training and evaluation data so you can check whether a model generalizes.',
};

export function InteractiveDemo({ initialSkill, onClose }) {
  const dialog = useRef(null);
  const [skill, setSkill] = useState(initialSkill || skills[0]);
  const [step, setStep] = useState(initialSkill ? 1 : 0);
  const [answer, setAnswer] = useState(null);
  const [highlighted, setHighlighted] = useState(false);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.current.showModal();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="demo-dialog" aria-labelledby="demo-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }}>
    <button className="demo-close" onClick={onClose} aria-label="Close walkthrough">×</button>
    <p className="demo-eyebrow">TRY SKILLMARK · INTERACTIVE DEMO</p>
    <h2 id="demo-title">From a highlight to your next skill.</h2>
    <div className="demo-tabs" aria-label="Walkthrough steps">{['Highlight', 'Explore', 'Practice'].map((label, i) => <button key={label} aria-current={step === i ? 'step' : undefined} onClick={() => setStep(i)}>{i + 1}. {label}</button>)}</div>
    <div className="demo-panel" key={step}>
      {step === 0 && <><h3>Make your reading count.</h3><p>Click the sentence below to save a sample highlight.</p><button className={`sample-highlight ${highlighted ? 'is-highlighted' : ''}`} aria-pressed={highlighted} onClick={() => setHighlighted(!highlighted)}><span className="sample-highlight-text">A useful AI workflow pairs a clear goal with reliable sources and a check of the final answer.</span></button><p className="demo-feedback" aria-live="polite">{highlighted ? 'Highlight saved in this demo. Skill detected: Agentic workflows.' : 'Your reading is the starting point.'}</p><button className="demo-primary" onClick={() => { setSkill(skills[0]); setStep(1); }}>Explore the skill →</button></>}
      {step === 1 && <><h3>Choose a skill to explore.</h3><div className="skill-options">{skills.map(item => <button key={item} aria-pressed={skill === item} onClick={() => setSkill(item)}>{item}</button>)}</div><div className="skill-detail" key={skill}><h4>{skill}</h4><p>{lessons[skill]}</p></div><button className="demo-primary" onClick={() => setStep(2)}>Try a practice question →</button></>}
      {step === 2 && <><h3>A model keeps inventing citations. What should you try first?</h3><div className="answer-options">{['Raise the temperature', 'Ground the answer in reliable sources', 'Ask for a longer answer'].map((label, i) => <button key={label} aria-pressed={answer === i} className={answer === i ? (i === 1 ? 'correct' : 'retry') : ''} onClick={() => setAnswer(i)}>{label}</button>)}</div><p className="demo-feedback" role="status">{answer === null ? 'Pick an answer to get feedback.' : answer === 1 ? 'Exactly. Providing reliable sources makes claims easier to verify. Always check that the sources support the answer.' : 'Try again. More randomness or more text does not make a citation trustworthy. Think about the evidence the model can use.'}</p>{answer === 1 && <button className="demo-primary" onClick={() => { setStep(0); setAnswer(null); setHighlighted(false); }}>Try the loop again ↻</button>}</>}
    </div>
    <p className="demo-note">Sample content only. This demo does not read or save your browsing history.</p>
  </dialog>;
}
