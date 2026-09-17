import React, { useEffect, useRef, useState } from 'react';
import { DAYS, PACES, todayInZone, prepareLearningPlan } from '../../shared/learning-plan.js';
import { generateLearningPlan } from '../lib/learning-api.js';
import { emptyLearningState, readLearningState, writeLearningState } from '../lib/learning-state.js';
import './LearningJourney.css';

export function useLearningJourney(userId) {
  const [storageError,setStorageError] = useState('');
  const [initial] = useState(() => {
    try { return {data:readLearningState(window.localStorage, userId)}; }
    catch { return {data:emptyLearningState(),error:'Could not read the saved plan in this browser. It has not been overwritten. You can generate a new plan or review your saved flashcards.'}; }
  });
  const [data,setData] = useState(initial.data);
  useEffect(() => {
    if(initial.error && data===initial.data){setStorageError(initial.error);return;}
    try { writeLearningState(window.localStorage,userId,data); setStorageError(''); }
    catch { setStorageError('Browser storage is unavailable or full. Your changes are only kept while this tab is open; export your plan before leaving.'); }
  },[userId,data,initial]);
  const savePlan = plan => setData(current=>({...current,plan,progress:{}}));
  const updateProgress = (id,patch) => setData(current=>({...current,progress:{...current.progress,[id]:{...current.progress[id],...patch}}}));
  const reviewCard = (id,value) => setData(current=>({...current,reviews:{...current.reviews,[id]:{value,at:new Date().toISOString()}}}));
  return { ...data,storageError,savePlan,updateProgress,reviewCard };
}

function defaults() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return { level:'beginner',currentSkills:'',goal:'',constraints:'',learningStyle:'mixed',pace:'steady',timezone,
    startDate:todayInZone(timezone),targetDate:'',weeks:4,availability:[],
  };
}
const niceDate = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});

export function PlanQuestionnaire({ career, previousContext, onGenerated, onBack }) {
  const [context,setContext] = useState(() => previousContext ? {...previousContext,startDate:previousContext.startDate < todayInZone(previousContext.timezone) ? todayInZone(previousContext.timezone) : previousContext.startDate} : defaults());
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const request = useRef(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  const change = (key,value) => setContext(current=>({...current,[key]:value}));
  function toggleDay(day) {
    setContext(current=>({...current,availability:current.availability.some(a=>a.day===day) ? current.availability.filter(a=>a.day!==day) : [...current.availability,{day,start:'19:00',end:'20:00'}]}));
  }
  function changeWindow(day,key,value) {
    setContext(current=>({...current,availability:current.availability.map(a=>a.day===day?{...a,[key]:value}:a)}));
  }
  let preview;
  try { preview = prepareLearningPlan({career,context}).slots; } catch {}
  async function submit(event) {
    event.preventDefault(); setError('');
    try { prepareLearningPlan({career,context}); } catch (e) { setError(e.message); return; }
    setBusy(true); request.current = new AbortController();
    try { const plan = await generateLearningPlan({career,context},request.current.signal); onGenerated(plan); }
    catch (e) { if(e.name!=='AbortError')setError(e.message); }
    finally { setBusy(false); }
  }
  return <form className="lj-form" onSubmit={submit} aria-busy={busy}>
    <p className="sw-eyebrow">MAKE THIS PATH YOURS</p>
    <h3>Your goals. Your available time.</h3>
    <p>Tell us where you are starting. We will build your first {context.weeks} weeks toward {career.name}.</p>
    {error&&<div className="sw-notice sw-notice-error" role="alert">{error}</div>}
    <fieldset disabled={busy}>
      <div className="lj-fields">
        <label>Experience level<select value={context.level} onChange={e=>change('level',e.target.value)}><option value="beginner">Starting from the basics</option><option value="some-experience">Some experience</option><option value="experienced">Experienced, changing or deepening skills</option></select></label>
        <label>How do you learn best?<select value={context.learningStyle} onChange={e=>change('learningStyle',e.target.value)}><option value="mixed">A mix of learning and building</option><option value="projects">Hands-on projects</option><option value="reading">Reading, then applying</option></select></label>
      </div>
      <label>What can you already do?<textarea value={context.currentSkills} onChange={e=>change('currentSkills',e.target.value)} maxLength={1500} placeholder="Languages, courses, projects, or skills you already know" rows={2}/></label>
      <label>What do you want to achieve?<textarea required value={context.goal} onChange={e=>change('goal',e.target.value)} maxLength={1500} placeholder="Describe a concrete outcome you want to work toward" rows={3}/></label>
      <div className="lj-fields">
        <label>Learning pace<select value={context.pace} onChange={e=>change('pace',e.target.value)}><option value="gentle">Gentle · up to 30 min/day</option><option value="steady">Steady · up to 45 min/day</option><option value="intensive">Focused · up to 60 min/day</option></select></label>
        <label>Initial plan length<select value={context.weeks} onChange={e=>change('weeks',Number(e.target.value))}>{[1,2,3,4].map(w=><option key={w} value={w}>{w} {w===1?'week':'weeks'}</option>)}</select></label>
        <label>Start date<input required type="date" value={context.startDate} onChange={e=>change('startDate',e.target.value)}/></label>
        <label>Goal deadline (optional)<input type="date" min={context.startDate} value={context.targetDate} onChange={e=>change('targetDate',e.target.value)}/></label>
      </div>
      <label>Timezone<input required value={context.timezone} onChange={e=>change('timezone',e.target.value)} maxLength={80} placeholder="Asia/Bangkok" list="learning-timezones"/></label>
      <datalist id="learning-timezones">{['Asia/Bangkok','Asia/Ho_Chi_Minh','Asia/Singapore','Asia/Tokyo','Europe/London','Europe/Paris','America/New_York','America/Los_Angeles','Australia/Sydney','UTC'].map(zone=><option key={zone} value={zone}/>)}</datalist>
      <div className="lj-availability"><h4>When are you free?</h4><p className="sw-small">Choose your days and time windows. One session per selected day, up to {PACES[context.pace]} minutes; shorter windows stay shorter. All times use your timezone.</p>
        {[1,2,3,4,5,6,0].map(day=>{
          const available = context.availability.find(a=>a.day===day);
          return <div className="lj-day" key={day}><label><input type="checkbox" checked={!!available} onChange={()=>toggleDay(day)}/>{DAYS[day]}</label>{available&&<div><label><span className="sw-sr-only">{DAYS[day]} start time</span><input required type="time" value={available.start} onChange={e=>changeWindow(day,'start',e.target.value)}/></label><span>to</span><label><span className="sw-sr-only">{DAYS[day]} end time</span><input required type="time" value={available.end} onChange={e=>changeWindow(day,'end',e.target.value)}/></label></div>}</div>;
        })}
      </div>
      <label>Anything else to plan around?<textarea value={context.constraints} onChange={e=>change('constraints',e.target.value)} maxLength={1500} placeholder="Work or school, budget, equipment, preferred language, or learning needs" rows={3}/></label>
      {preview&&<div className="lj-capacity">{preview.length} sessions · {(preview.reduce((sum,s)=>sum+s.minutes,0)/60).toFixed(1)} hours total · {niceDate(preview[0].date)} – {niceDate(preview.at(-1).date)}</div>}
      <p className="sw-small">Your answers and the selected career are sent to DeepSeek to generate this plan. Plans and progress are saved for your account in this browser. Generating a new plan replaces the active plan and its progress only after generation succeeds.</p>
      <div className="sw-actions"><button type="button" className="sw-button secondary" onClick={onBack}>Back to skills</button><button type="submit" className="sw-button">{busy?'Building your roadmap…':'Generate my roadmap'}</button></div>
    </fieldset>
    {busy&&<p role="status" className="lj-generating">Building your sessions and practice questions. This can take up to two minutes.</p>}
  </form>;
}

export function LearningRoadmap({ plan, progress, onPractice, onEdit }) {
  if (!plan) return null;
  const completed = plan.sessions.filter(s=>progress[s.id]?.done).length;
  function exportPlan() {
    const blob = new Blob([JSON.stringify({plan,progress},null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href=url; link.download='skillmark-learning-plan.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="lj-roadmap" aria-labelledby="learning-plan-title">
    <div className="sw-roadmap-hero"><div><p className="sw-eyebrow">YOUR PERSONAL ROADMAP</p><h2 id="learning-plan-title">{plan.career.name}</h2><p>{plan.summary}</p><span className="sw-tag">{plan.context.timezone}</span></div><div className="sw-road-progress"><strong>{completed}<span>/{plan.sessions.length}</span></strong><p>sessions completed</p></div><div className="sw-actions"><button className="sw-button" onClick={()=>onPractice()}>Start practicing</button><button className="sw-button secondary" onClick={onEdit}>Adjust my plan</button><button className="sw-link" onClick={exportPlan}>Export plan</button></div></div>
    <p className="lj-feasibility">{plan.feasibility}</p>
    <p className="sw-small">Times are in {plan.context.timezone}. This is your initial {plan.context.weeks}-week plan. Saved in this browser for your account.</p>
    <div className="lj-weeks">{plan.milestones.map((milestone,index)=><details key={milestone.week} open={index===0} className="sw-panel"><summary><span className="sw-eyebrow">WEEK {milestone.week}</span><strong>{milestone.title}</strong></summary><p>{milestone.outcome}</p><ol className="lj-sessions">{plan.sessions.filter(s=>s.week===milestone.week).map(session=><li key={session.id}><div className="lj-session-time"><strong>{niceDate(session.date)}</strong><span>{session.start}–{session.end}</span><span>{session.minutes} min</span></div><div><span className="sw-tag">{progress[session.id]?.done?'Completed':session.skill}</span><h3>{session.title}</h3><p>{session.objective}</p><p><strong>Build or demonstrate:</strong> {session.deliverable}</p><button className="sw-link" onClick={()=>onPractice(session.id)}>{progress[session.id]?.done?'Review session':'Open session'} →</button></div></li>)}</ol></details>)}</div>
  </section>;
}

export function PracticeWorkspace({ plan, progress, updateProgress, flashcards, flashcardsLoading, flashcardsError, reviews, reviewCard, initialSessionId, onCareer }) {
  const [mode,setMode] = useState(plan?'roadmap':'flashcards');
  const [selected,setSelected] = useState(initialSessionId || plan?.sessions.find(s=>!progress[s.id]?.done)?.id || plan?.sessions[0]?.id);
  const [cardIndex,setCardIndex] = useState(0);
  const [revealed,setRevealed] = useState(false);
  useEffect(()=>{ if(initialSessionId){setSelected(initialSessionId);setMode('roadmap');} },[initialSessionId]);
  const session = plan?.sessions.find(s=>s.id===selected) || plan?.sessions[0];
  const current = session ? progress[session.id] || {} : {};
  const card = flashcards[cardIndex % Math.max(flashcards.length,1)];
  useEffect(()=>setRevealed(false),[card?.id]);
  function nextCard(value) { reviewCard(card.id,value);setRevealed(false);setCardIndex(i=>(i+1)%flashcards.length); }
  function nextSession() { const index=plan.sessions.findIndex(s=>s.id===session.id);setSelected(plan.sessions[(index+1)%plan.sessions.length].id); }
  return <>
    <header className="sw-heading"><div><p className="sw-eyebrow">TURN LEARNING INTO PRACTICE</p><h1>Your practice<span>.</span></h1><p>Work through your personal roadmap or recall what you saved while reading.</p></div></header>
    <div className="lj-tabs" role="group" aria-label="Practice source"><button className="sw-button secondary" aria-pressed={mode==='roadmap'} onClick={()=>setMode('roadmap')}>Roadmap sessions</button><button className="sw-button secondary" aria-pressed={mode==='flashcards'} onClick={()=>setMode('flashcards')}>My flashcards ({flashcards.length})</button></div>
    {mode==='roadmap'&&(!plan?<div className="sw-empty"><h2>Choose a path to begin.</h2><p>Confirm a career, tell us your availability, and generate a roadmap with practice designed for you.</p><button className="sw-button" onClick={onCareer}>Explore career paths</button></div>:<div className="sw-two-col"><section className="sw-panel sw-practice" key={session.id}>
      <div className="sw-panel-title"><span className="sw-tag">{session.skill}</span><span>{niceDate(session.date)} · {session.start}–{session.end} · {plan.context.timezone}</span></div>
      <h2>{session.title}</h2><p>{session.objective}</p><div className="lj-task"><h3>Your activity</h3><p>{session.activity}</p><h3>What to produce</h3><p>{session.deliverable}</p></div>
      <h3>Check your understanding</h3><p>{session.question.prompt}</p><fieldset disabled={current.checked}><legend className="sw-sr-only">Choose an answer</legend>{session.question.options.map((option,i)=><label key={i} className={`sw-option ${current.answer===i?'selected':''} ${current.checked&&i===session.question.correctIndex?'correct':''}`}><input type="radio" name={`question-${session.id}`} checked={current.answer===i} onChange={()=>updateProgress(session.id,{answer:i})}/><span>{option}</span></label>)}</fieldset>
      {!current.checked?<button className="sw-button" disabled={!Number.isInteger(current.answer)} onClick={()=>updateProgress(session.id,{checked:true})}>Check my answer</button>:<div className="sw-feedback" role="status"><h3>{current.answer===session.question.correctIndex?'Correct — keep building.':'Review this idea, then try again.'}</h3><p>{session.question.explanation}</p><button className="sw-link" onClick={()=>updateProgress(session.id,{answer:null,checked:false})}>Try the question again</button></div>}
      <label className="lj-reflection">Your work or reflection<textarea rows={4} maxLength={4000} value={current.note || ''} onChange={e=>updateProgress(session.id,{note:e.target.value})} placeholder="Record what you built, a project link, or what you still want to understand."/></label>
      <div className="sw-actions"><button className="sw-button" disabled={!current.done&&(!current.checked||!current.note?.trim())} onClick={()=>updateProgress(session.id,{done:!current.done,completedAt:current.done?null:new Date().toISOString()})}>{current.done?'Mark as unfinished':'I completed this session'}</button><button className="sw-button secondary" onClick={nextSession}>Next session →</button></div><p className="sw-small">Completion is self-reported. Check the question and record your work before marking a session complete.</p>
    </section><aside className="sw-panel lj-session-list"><h2>{plan.career.name}</h2><p>{plan.sessions.filter(s=>progress[s.id]?.done).length} of {plan.sessions.length} sessions completed</p>{plan.sessions.map(s=><button key={s.id} aria-current={s.id===session.id?'step':undefined} onClick={()=>setSelected(s.id)}><span>{progress[s.id]?.done?'✓':s.week}</span><span><strong>{s.title}</strong><small>{niceDate(s.date)} · {s.start}</small></span></button>)}</aside></div>)}
    {mode==='flashcards'&&(flashcardsError?<div className="sw-notice sw-notice-error" role="alert">{flashcardsError}</div>:flashcardsLoading&&!card?<p role="status">Loading your flashcards…</p>:!card?<div className="sw-empty"><h2>Your own discoveries belong here.</h2><p>Use the extension to highlight a term and save its explanation. Your saved flashcards become recall practice here.</p><a className="sw-button" href="/extension">Set up the extension</a></div>:<section className="sw-panel lj-recall"><p className="sw-eyebrow">CARD {cardIndex%flashcards.length+1} OF {flashcards.length}</p><h2>{card.keyword}</h2><p>Explain this idea in your own words before revealing your saved explanation.</p>{!revealed?<button className="sw-button" onClick={()=>setRevealed(true)}>Reveal explanation</button>:<><blockquote>{card.explanation || 'No explanation was saved for this card.'}</blockquote><div className="sw-actions"><button className="sw-button secondary" onClick={()=>nextCard('review')}>Review again</button><button className="sw-button" onClick={()=>nextCard('remembered')}>I remembered it</button></div></>}{reviews[card.id]&&<p className="sw-small">Last review: {reviews[card.id].value==='remembered'?'remembered':'needs another look'}</p>}<p className="sw-small">Your recall progress is saved for this account in this browser.</p></section>)}
  </>;
}
