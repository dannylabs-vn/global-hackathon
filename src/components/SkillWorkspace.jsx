import React, { useEffect, useState } from 'react';
import './SkillWorkspace.css';
import { signOut } from '../lib/auth.js';
import { analyzeCareer, getCareerReports, getBookmarks, deleteBookmark, getAnalyticsData, getFlashcards } from '../lib/api.js';

const initialHighlights = [
  { title: 'Agentic workflows', source: 'Tech Horizon', quote: 'The shift is toward agentic workflows — where models don’t just answer questions, they take ownership of outcomes.' },
  { title: 'Design thinking', source: 'NN/g', quote: 'Start by understanding the problem from the perspective of the people experiencing it.' },
  { title: 'Prompt engineering', source: 'Simon Willison', quote: 'A useful prompt makes the task, context, and expected output explicit.' },
];
const questions = [
  { skill:'Analytical thinking', text:'Sales dropped last quarter. You have one large dataset and limited time.', question:'What’s your first move?', options:['Visualise the whole dataset at once','Break it into parts and compare segments','Ask a teammate to analyse it for you'], correct:1, reason:'Decompose the problem before visualising: compare segments to find where the drop comes from, then zoom into the one that moved. Visualising everything at once can hide the signal in noise.' },
  { skill:'Data storytelling', text:'You found that most of the sales decline came from one customer segment.', question:'How do you share your finding?', options:['Show every chart you created','Lead with the key finding and one supporting chart','Send the raw spreadsheet without context'], correct:1, reason:'Lead with the finding, support it with a focused visual, and explain what decision it helps the team make.' },
  { skill:'System design', text:'An API is slow because it repeatedly fetches the same public data.', question:'What should you investigate first?', options:['Measure the bottleneck and evaluate caching','Rewrite the entire application','Add more frontend animations'], correct:0, reason:'Measure before changing the system. If repeated reads are the bottleneck, caching may reduce latency; consider how fresh the data needs to be.' },
];
const navigation = [['map','◈','Skill map'],['roadmap','⌁','Career Analysis'],['practice','✦','Practice'],['highlights','▤','Bookmark'],['flashcards','✎','Highlight'],['profile','◎','Profile']];
const status = value => value >= 55 ? 'Growing' : value >= 40 ? 'At-risk' : 'Foundational';
const currentView = () => [...navigation.map(n=>n[0]),'reading'].includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'map';
const formatDate = iso => { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); } catch { return ''; } };
const hostnameOf = url => { if (!url) return ''; try { return new URL(url).hostname; } catch { return url; } };
const DOMAIN_COLORS = ['var(--brand)','#d4a15b','var(--brand-deep)','#8a8f99','#4b3f8f','var(--lime)'];
function buildConicGradient(domainStats) {
  const total = domainStats.reduce((sum,[,v])=>sum+v,0);
  if (!total) return '#eef3ee';
  let acc = 0;
  const stops = domainStats.map(([,value],i)=>{
    const start = (acc/total)*100;
    acc += value;
    const end = (acc/total)*100;
    return `${DOMAIN_COLORS[i%DOMAIN_COLORS.length]} ${start}% ${end}%`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}
function computeWeekly(list) {
  const dayKeys = [];
  const today = new Date();
  for (let i=6;i>=0;i--) { const d=new Date(today); d.setDate(d.getDate()-i); d.setHours(0,0,0,0); dayKeys.push(d.toISOString().slice(0,10)); }
  const counts = dayKeys.map(key => list.filter(b => b.created_at && new Date(b.created_at).toISOString().slice(0,10)===key).length);
  const labels = dayKeys.map(key => new Date(`${key}T00:00:00`).toLocaleDateString('en-US',{weekday:'narrow'}));
  return { counts, labels };
}

export function SkillWorkspace() {
  const [view,setView] = useState(currentView);
  const [highlights,setHighlights] = useState(initialHighlights);
  const [questionIndex,setQuestionIndex] = useState(0);
  const [answer,setAnswer] = useState(null);
  const [submitted,setSubmitted] = useState(false);
  const [completed,setCompleted] = useState([]);
  const [plan,setPlan] = useState([]);
  const [notice,setNotice] = useState('');
  const [search,setSearch] = useState('');
  const [name,setName] = useState('Learner');
  const [direction,setDirection] = useState('Technology & AI');
  const [weekly,setWeekly] = useState('3');
  const [reverse,setReverse] = useState(false);
  const [niches,setNiches] = useState([]);
  const [topTopics,setTopTopics] = useState([]);
  const [analyzedAt,setAnalyzedAt] = useState(null);
  const [analyzing,setAnalyzing] = useState(false);
  const [analyzeError,setAnalyzeError] = useState('');
  const [reports,setReports] = useState([]);
  const [reportsLoading,setReportsLoading] = useState(false);
  const [reportsLoaded,setReportsLoaded] = useState(false);
  const [selectedNiche,setSelectedNiche] = useState(null);
  const [bookmarks,setBookmarks] = useState([]);
  const [bookmarksLoading,setBookmarksLoading] = useState(false);
  const [bookmarksError,setBookmarksError] = useState('');
  const [domainStats,setDomainStats] = useState([]);
  const [topicStats,setTopicStats] = useState([]);
  const [analyticsLoading,setAnalyticsLoading] = useState(false);
  const [analyticsLoaded,setAnalyticsLoaded] = useState(false);
  const [flashcards,setFlashcards] = useState([]);
  const [flashcardsLoading,setFlashcardsLoading] = useState(false);
  const [flashcardsError,setFlashcardsError] = useState('');
  const [flashcardsLoaded,setFlashcardsLoaded] = useState(false);
  const q = questions[questionIndex];
  function go(next) { window.location.hash=next; setView(next); setNotice(''); }
  function addToPlan(topic) { setPlan(items => items.includes(topic) ? items : [...items,topic]); setNotice(`${topic} is on your roadmap.`); }
  function exportData() { const url=URL.createObjectURL(new Blob([JSON.stringify({demo:true,name,direction,weekly,highlights,plan,completed},null,2)],{type:'application/json'})); const a=document.createElement('a'); a.href=url; a.download='skillmark-workspace.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); setNotice('Your workspace has been exported.'); }
  async function handleSignOut() { await signOut(); window.location.href='/'; }
  async function loadReports() {
    setReportsLoading(true);
    const { data, error } = await getCareerReports();
    setReportsLoading(false);
    if (error || !data) { setReports([]); return; }
    setReports(data);
    if (data.length) {
      try {
        const parsed = JSON.parse(data[0].report_text);
        setNiches(parsed.niches||[]);
        setTopTopics(parsed.top_topics||[]);
        setAnalyzedAt(parsed.analyzed_at||data[0].created_at);
      } catch {}
    }
  }
  async function handleAnalyze() {
    setAnalyzing(true);
    setAnalyzeError('');
    const { data, error } = await analyzeCareer();
    setAnalyzing(false);
    if (error) { setAnalyzeError(error.message||'Could not analyze your career path right now. Please try again.'); return; }
    setNiches(data?.niches||[]);
    setTopTopics(data?.top_topics||[]);
    setAnalyzedAt(data?.analyzed_at||new Date().toISOString());
    loadReports();
  }
  function openReport(report) {
    try {
      const parsed = JSON.parse(report.report_text);
      setNiches(parsed.niches||[]);
      setTopTopics(parsed.top_topics||[]);
      setAnalyzedAt(parsed.analyzed_at||report.created_at);
      setAnalyzeError('');
    } catch { setAnalyzeError('Could not read this report.'); }
  }
  async function loadBookmarks() {
    setBookmarksError('');
    setBookmarksLoading(true);
    const { data, error } = await getBookmarks();
    setBookmarksLoading(false);
    if (error) { setBookmarksError(error.message||'Could not load bookmarks.'); return; }
    setBookmarks(data||[]);
  }
  async function handleDeleteBookmark(id) {
    const { error } = await deleteBookmark(id);
    if (error) { setBookmarksError(error.message||'Could not delete this bookmark.'); return; }
    setBookmarks(items=>items.filter(item=>item.id!==id));
    setNotice('Bookmark removed.');
  }
  async function loadAnalytics() {
    setAnalyticsLoading(true);
    const { data, error } = await getAnalyticsData();
    setAnalyticsLoading(false);
    if (error || !data) { setDomainStats([]); setTopicStats([]); return; }
    const categoryCount = {};
    const topicCount = {};
    data.forEach(item => {
      const cat = item.domain_category || 'Other';
      categoryCount[cat] = (categoryCount[cat]||0)+1;
      (item.topics||[]).forEach(t => { topicCount[t] = (topicCount[t]||0)+1; });
    });
    const sortedCats = Object.entries(categoryCount).sort((a,b)=>b[1]-a[1]);
    const top5 = sortedCats.slice(0,5);
    const otherTotal = sortedCats.slice(5).reduce((sum,[,v])=>sum+v,0);
    setDomainStats(otherTotal>0 ? [...top5,['Other',otherTotal]] : top5);
    setTopicStats(Object.entries(topicCount).sort((a,b)=>b[1]-a[1]).slice(0,10));
  }
  async function loadFlashcards() {
    setFlashcardsLoading(true);
    const { data, error } = await getFlashcards();
    setFlashcardsLoading(false);
    if (error) { setFlashcardsError(error.message||'Could not load flashcards.'); return; }
    setFlashcards(data||[]);
  }
  useEffect(()=>{document.documentElement.lang='en';document.title='Your learning workspace · Skillmark';},[]);
  useEffect(()=>{const sync=()=>{setView(currentView());setNotice('');};window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
  useEffect(()=>{document.querySelector('.sw-main')?.focus(); window.scrollTo(0,0);},[view]);
  useEffect(()=>{ if (view==='roadmap' && !reportsLoaded) { setReportsLoaded(true); loadReports(); } },[view,reportsLoaded]);
  useEffect(()=>{
    loadBookmarks();
    const refresh = () => { if (!document.hidden) { loadBookmarks(); loadAnalytics(); if (view === 'flashcards') loadFlashcards(); } };
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 15000);
    return () => { window.removeEventListener('focus', refresh); clearInterval(timer); };
  },[view]);
  useEffect(()=>{ if (view==='map' && !analyticsLoaded) { setAnalyticsLoaded(true); loadAnalytics(); } },[view,analyticsLoaded]);
  useEffect(()=>{ if (view==='flashcards' && !flashcardsLoaded) { setFlashcardsLoaded(true); loadFlashcards(); } },[view,flashcardsLoaded]);
  const heading = (eyebrow,title,description,actions) => <header className="sw-heading"><div><p className="sw-eyebrow">{eyebrow}</p><h1>{title}<span>.</span></h1><p>{description}</p></div><div className="sw-actions">{actions}</div></header>;
  const button = (label,action,secondary=false,disabled=false) => <button className={`sw-button ${secondary?'secondary':''}`} onClick={action} disabled={disabled}>{label}</button>;
  return <div className="sw-app">
    <aside className="sw-sidebar"><a href="/" className="site-brand"><span className="brand-skill">Skill</span><span className="brand-mark">mark.</span></a><p className="sw-eyebrow">YOUR WORKSPACE</p><nav aria-label="Workspace">{navigation.map(([id,icon,label])=><button key={id} onClick={()=>go(id)} aria-current={view===id?'page':undefined}><span aria-hidden="true">{icon}</span>{label}{id==='highlights'&&<small>{bookmarks.length}</small>}</button>)}</nav><div className="sw-sidebar-note"><span>✦</span><strong>A little curiosity.<br/>A clearer direction.</strong><p>Turn what you read into what you do next.</p><a href="/">Back to the website ↗</a></div><button className="sw-person" onClick={()=>go('profile')}><span className="sw-avatar">{name.trim().split(/\s+/).map(s=>s[0]).slice(0,2).join('')}</span><span><strong>{name}</strong><small>Your learning space</small></span><span>↗</span></button></aside>
    <div className="sw-body"><div className="sw-topbar"><span>Workspace <span>/</span> <strong>{navigation.find(n=>n[0]===view)?.[2]||'Reading'}</strong></span><a className="sw-link" href="/extension">Set up extension</a></div><main key={view} className="sw-main" tabIndex={-1}>{!['map','roadmap','highlights','flashcards'].includes(view)&&<p className="sw-demo-note">Sample learning data · Changes last for this session · No AI service connected</p>}{notice&&<div className="sw-notice" role="status">✓ {notice}<button aria-label="Dismiss notification" onClick={()=>setNotice('')}>×</button></div>}
    {view==='map'&&<>{heading('FOLLOW YOUR CURIOSITY','Your skill gap map','A little more clarity on what to explore next.',<>{button('Export',exportData,true)}{button('Practice now ↗',()=>go('practice'))}</>)}<div className="sw-stats"><div><span className="sw-stat-icon">◈</span><div><strong>{topicStats.length}</strong><span>topics from your bookmarks</span></div></div><div><span className="sw-stat-icon">▤</span><div><strong>{highlights.length}</strong><span>saved highlights</span></div></div><div><span className="sw-stat-icon">✦</span><div><strong>{completed.length}</strong><span>practices completed</span></div></div></div><div className="sw-map-grid"><section className="sw-panel sw-signal"><div className="sw-panel-title"><h2>Signal mix</h2><span>By domain category</span></div><div className="sw-donut" role="img" aria-label={domainStats.length?domainStats.map(([l,v])=>`${v} ${l}`).join(', '):'No bookmarks analyzed yet'} style={{background:buildConicGradient(domainStats)}}><div><strong>{domainStats.reduce((sum,[,v])=>sum+v,0)}</strong><span>bookmarks analyzed</span></div></div><div className="sw-legend">{domainStats.length?domainStats.map(([label,value],i)=><div key={label}><i style={{background:DOMAIN_COLORS[i%DOMAIN_COLORS.length]}}/><span>{label}</span><strong>{value}</strong></div>):<p className="sw-small">No bookmarks analyzed yet.</p>}</div><p className="sw-small">A starting point for exploration, not a measure of your ability.</p></section><section className="sw-panel sw-coverage"><div className="sw-panel-title"><h2>Skill coverage</h2><button className="sw-link" onClick={()=>setReverse(!reverse)}>{reverse?'Lowest first':'Highest first'} ↓</button></div>{(()=>{const maxCount=Math.max(1,...topicStats.map(([,c])=>c));const rows=topicStats.map(([title,count])=>[title,Math.round((count/maxCount)*100)]);return [...rows].sort((a,b)=>reverse?a[1]-b[1]:b[1]-a[1]).map(([title,value])=><button className="sw-skill" key={title} onClick={()=>{addToPlan(title);}} aria-label={`Add ${title} to roadmap`}><span>{title}<b>{value}%</b></span><span className="sw-track"><span className={status(value).toLowerCase()} style={{width:`${value}%`}}/></span></button>);})()}{!topicStats.length&&<p className="sw-small">No topics yet — save a few bookmarks to see your top topics here.</p>}<div className="sw-insight"><span>↗</span><p><strong>Curiosity becomes momentum.</strong><br/>Choose a skill to add it to your roadmap.</p></div></section><aside className="sw-right"><section className="sw-activity"><p className="sw-eyebrow">A WEEK OF SMALL DISCOVERIES</p><div className="sw-bars" aria-label="Bookmarks saved per day, last 7 days">{(()=>{const {counts,labels}=computeWeekly(bookmarks);const maxCount=Math.max(1,...counts);return counts.map((c,i)=><div key={i}><span style={{height:`${Math.round((c/maxCount)*100)}%`}}/><small>{labels[i]}</small></div>);})()}</div><p className="sw-small">Last 7 days</p></section><section className="sw-focus"><span className="sw-eyebrow">YOUR NEXT SMALL STEP</span><h2>Make room for<br/>a new perspective.</h2><p>Explore system design and data storytelling with a short practice.</p><button className="sw-link" onClick={()=>go('practice')}>Give it a try <span>↗</span></button></section><section className="sw-recent"><div className="sw-panel-title"><h2>Recent highlights</h2><button className="sw-link" onClick={()=>go('highlights')}>View all</button></div>{highlights.slice(0,3).map(h=><button key={h.title} onClick={()=>go('reading')}><span>▤</span><div><strong>{h.title}</strong><small>{h.source}</small></div><span>↗</span></button>)}{!highlights.length&&<p>No highlights yet. Open the reading sample to save one.</p>}</section></aside></div></>}
    {view==='roadmap'&&<>{heading('CAREER PATH ANALYSIS','Career Path Analysis','See which IT career paths best match what you have been reading about.',button(analyzing?'Analyzing…':niches.length?'Re-analyze':'Analyze my career path',handleAnalyze,false,analyzing))}
    {analyzeError&&<div className="sw-notice sw-notice-error" role="alert">⚠ {analyzeError}<button aria-label="Dismiss error" onClick={()=>setAnalyzeError('')}>×</button></div>}
    <div className="sw-two-col"><div>
    <section className="sw-panel sw-niche-list"><div className="sw-panel-title"><h2>Top matching paths</h2>{analyzedAt&&<span>Updated {formatDate(analyzedAt)}</span>}</div>
    {niches.length?niches.map((niche,i)=><button type="button" className="sw-road-row sw-niche-row" key={niche.id||niche.name} onClick={()=>setSelectedNiche(niche)}><span className="sw-step">{i+1}</span><div><h3>{niche.name}</h3><p>{niche.match_reason}</p><span className="sw-track"><span className={status(niche.match_percent||0).toLowerCase()} style={{width:`${niche.match_percent||0}%`}}/></span></div><span className="sw-tag">{niche.match_percent}% match</span></button>)
    :<div className="sw-empty"><h2>No analysis yet</h2><p>Save a few pages while you browse, then run your first career path analysis to see your top 5 matches.</p>{button(analyzing?'Analyzing…':'Analyze my career path',handleAnalyze,false,analyzing)}</div>}
    </section>
    <section className="sw-panel sw-recent sw-report-history"><div className="sw-panel-title"><h2>Previous reports</h2></div>
    {reportsLoading?<p className="sw-small">Loading history…</p>:reports.length?reports.slice(0,6).map(r=><button key={r.id} onClick={()=>openReport(r)}><span>◎</span><div><strong>{formatDate(r.created_at)}</strong><small>{(r.suggested_paths||[]).slice(0,3).join(' · ')||'—'}</small></div><span>↗</span></button>):<p className="sw-small">No previous reports yet.</p>}
    </section>
    </div><aside className="sw-focus"><p className="sw-eyebrow">HOW THIS WORKS</p><h2>Built from<br/>what you save.</h2><p>We look at the topics across your saved bookmarks and match them against 15 IT career paths, from frontend to machine learning.</p>{topTopics.length>0&&<div className="sw-topic-chips">{topTopics.slice(0,8).map(t=><span className="sw-tag" key={t}>{t}</span>)}</div>}</aside></div></>}
    {view==='practice'&&<>{heading('TRY. REFLECT. GROW.','Put curiosity into practice',`Scenario ${questionIndex+1} of ${questions.length} · a few minutes to see things differently.`)}<div className="sw-two-col"><section key={questionIndex} className="sw-panel sw-practice"><div className="sw-panel-title"><span className="sw-eyebrow">{q.skill.toUpperCase()}</span><span className="sw-tag">≈ 3 min</span></div><p className="sw-eyebrow">THE SCENARIO</p><h2>{q.text}</h2><p>{q.question}</p><fieldset disabled={submitted}><legend className="sw-sr-only">Choose your answer</legend>{q.options.map((option,i)=><label className={`sw-option ${answer===i?'selected':''} ${submitted&&i===q.correct?'correct':''}`} key={option}><input type="radio" name="answer" checked={answer===i} onChange={()=>setAnswer(i)}/><span className="sw-letter">{'ABC'[i]}</span><span>{option}</span>{submitted&&i===q.correct&&<b>✓</b>}</label>)}</fieldset>{!submitted?<button className="sw-button" disabled={answer===null} onClick={()=>{setSubmitted(true);setCompleted(items=>items.includes(questionIndex)?items:[...items,questionIndex]);}}>Check my answer ↗</button>:<div className="sw-feedback" role="status"><p className="sw-eyebrow">A MOMENT TO REFLECT</p><h3>{answer===q.correct?'You found a useful starting point.':'Another way to look at it.'}</h3><p>{q.reason}</p><div className="sw-actions">{button(plan.includes(q.skill)?'Added to roadmap ✓':'Add to roadmap',()=>addToPlan(q.skill),true)}{button(questionIndex===questions.length-1?'Review my map ↗':'Next question →',()=>{if(questionIndex===questions.length-1)go('map');else{setQuestionIndex(questionIndex+1);setAnswer(null);setSubmitted(false);}})}</div></div>}</section><aside><section className="sw-focus"><p className="sw-eyebrow">FOCUS MODE</p><h2>Understanding<br/>starts with trying.</h2><p>There’s no score to chase. Notice how you approach the problem, then take one idea into your next attempt.</p></section><section className="sw-panel sw-up-next"><p className="sw-eyebrow">EXPLORE A SCENARIO</p>{questions.map((item,i)=><button key={item.skill} onClick={()=>{setQuestionIndex(i);setAnswer(null);setSubmitted(false);}}><span className="sw-step">{completed.includes(i)?'✓':i+1}</span><strong>{item.skill}</strong><span>↗</span></button>)}</section></aside></div></>}
    {view==='highlights'&&<>{heading('KEEP WHAT MAKES YOU THINK','Your highlights','Small discoveries, collected in one place.',button('Open reading sample ↗',()=>go('reading')))}
    {bookmarksError&&<div className="sw-notice sw-notice-error" role="alert">⚠ {bookmarksError}<button aria-label="Dismiss error" onClick={()=>setBookmarksError('')}>×</button></div>}
    {bookmarksLoading?<p className="sw-small">Loading bookmarks…</p>:bookmarks.length===0?<div className="sw-empty"><h2>Chưa có bookmark nào.</h2><p>Dùng extension để lưu trang web bạn quan tâm.</p></div>:<>
    <label className="sw-search">Search highlights<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Try agentic workflows…" type="search"/></label>
    <div className="sw-highlight-grid">{bookmarks.filter(b=>((b.title||'')+' '+(b.bookmark_analysis?.[0]?.summary||'')).toLowerCase().includes(search.toLowerCase())).map(b=><article className="sw-panel" key={b.id}><span className="sw-tag">{b.bookmark_analysis?.[0]?.domain_category||b.status}</span><blockquote>“{b.bookmark_analysis?.[0]?.summary||(b.status==='pending'?'Analyzing…':b.status==='failed'?'Analysis failed.':'No summary yet.')}”</blockquote><p className="sw-small">{b.title||b.url} · {formatDate(b.created_at)}</p><div className="sw-actions"><button className="sw-link" onClick={()=>handleDeleteBookmark(b.id)}>Remove</button></div></article>)}</div>
    {!bookmarks.some(b=>((b.title||'')+' '+(b.bookmark_analysis?.[0]?.summary||'')).toLowerCase().includes(search.toLowerCase()))&&<div className="sw-empty"><h2>No highlights found.</h2><p>Try another search or save a passage from the reading sample.</p>{button('Explore a reading ↗',()=>go('reading'))}</div>}
    </>}</>}
    {view==='flashcards'&&<>{heading('SAVE WHAT YOU LEARN','Your flashcards','Keywords you highlighted and had explained on the web, saved here to review.')}
    {flashcardsError&&<div className="sw-notice sw-notice-error" role="alert">⚠ {flashcardsError}<button aria-label="Dismiss error" onClick={()=>setFlashcardsError('')}>×</button></div>}
    {flashcardsLoading?<p className="sw-small">Loading flashcards…</p>:flashcards.length===0?<div className="sw-empty"><h2>No flashcards yet.</h2><p>Highlight a word on any page with the extension (Ctrl+Shift+E) and save it as a flashcard.</p></div>:
    <div className="sw-highlight-grid">{flashcards.map(f=><article className="sw-panel" key={f.id}><span className="sw-tag">{f.keyword}</span><blockquote>“{f.explanation||'No explanation saved.'}”</blockquote><p className="sw-small">{hostnameOf(f.source_url)||'Unknown source'} · {formatDate(f.created_at)}</p></article>)}</div>}
    </>}
    {view==='reading'&&<>{heading('READ SOMETHING. FIND A DIRECTION.','A moment of discovery','Pause on an idea. Discover what you want to understand next.',button('My highlights ↗',()=>go('highlights'),true))}<div className="sw-two-col"><article className="sw-panel sw-article"><p className="sw-eyebrow">FIELD GUIDE · 6 MIN READ</p><h2>The quiet rise of AI agents</h2><p className="sw-small">Tech Horizon · Sample article</p><p>Most of us talk about AI as if it’s one thing. But the teams shipping the future aren’t just building chatbots — they’re building agents: systems that plan, act, and correct course.</p><p>That changes which skills matter. Debugging an agent means reasoning about plans and trade-offs, not just syntax — the kind of judgment you build by reading widely.</p><blockquote>{initialHighlights[0].quote}</blockquote><div className="sw-actions">{button(highlights.some(h=>h.title==='Agentic workflows')?'Highlight saved ✓':'Save this highlight',()=>{setHighlights(items=>items.some(h=>h.title==='Agentic workflows')?items:[initialHighlights[0],...items]);setNotice('Agentic workflows saved to your highlights.');},true)}{button('Explore this skill ↗',()=>addToPlan('Agentic workflows'))}</div><p>Reading can become the beginning of a learning plan. Follow the ideas that make you pause, try them in practice, and reflect on what you want to understand next.</p></article><aside className="sw-focus"><p className="sw-eyebrow">THE IDEA BEHIND THE HIGHLIGHT</p><span className="sw-tag">Growing skill · sample</span><h2>Agentic workflows</h2><p>Designing, steering, and debugging AI systems that act on their own.</p>{button('Add to my roadmap ↗',()=>addToPlan('Agentic workflows'))}<button className="sw-link" onClick={()=>go('practice')}>Try a practice →</button><p className="sw-small">This explanation is sample content, not a live AI response.</p></aside></div></>}
    {view==='profile'&&<>{heading('YOUR DIRECTION. YOUR CHOICE.','Make this space yours','An exploration, not a label. Change your direction whenever you like.')}<div className="sw-two-col"><form className="sw-panel sw-profile-form" onSubmit={e=>{e.preventDefault();setNotice('Your preferences have been updated for this session.');}}><h2>Your starting point</h2><label>Name<input required maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label><label>What would you like to explore?<select value={direction} onChange={e=>setDirection(e.target.value)}><option>Technology & AI</option><option>Design & creativity</option><option>Data & analytical thinking</option><option>I’m still exploring</option></select></label><label>Practices per week<select value={weekly} onChange={e=>setWeekly(e.target.value)}><option value="1">1 · A gentle start</option><option value="3">3 · A steady rhythm</option><option value="5">5 · A little every weekday</option></select></label><button className="sw-button" type="submit">Save preferences ↗</button></form><section className="sw-focus"><p className="sw-eyebrow">YOU’RE IN CONTROL</p><h2>Your curiosity.<br/>Your data.</h2><p>Bookmarks and flashcards sync with the extension when you sign in with the same account. Practice and preferences last for this session.</p><p>Only pages and passages you choose to save are sent for analysis.</p>{button('Export my workspace ↗',exportData,true)}<button className="sw-link" onClick={handleSignOut}>Sign out</button></section></div></>}
    <footer className="sw-footer"><span>Skillmark · A little learning. A clearer you.</span><a href="/">Made for your curiosity ↗</a></footer></main></div>
    {selectedNiche&&<NicheDetailDialog niche={selectedNiche} onClose={()=>setSelectedNiche(null)}/>}
  </div>;
}
function NicheDetailDialog({ niche, onClose }) {
  const ref = React.useRef(null);
  useEffect(() => { const previous = document.activeElement; ref.current.showModal(); return () => previous?.focus(); }, []);
  const skills = [...(niche.skills||[])].sort((a,b)=>(a.order||0)-(b.order||0));
  return <dialog ref={ref} className="sw-dialog sw-niche-dialog" onCancel={onClose} aria-labelledby="niche-dialog-title">
    <button className="sw-icon-close" aria-label="Close" onClick={onClose}>×</button>
    <p className="sw-eyebrow">{niche.match_percent}% MATCH</p>
    <h2 id="niche-dialog-title">{niche.name}</h2>
    <p>{niche.description}</p>
    <div className="sw-niche-reason"><span>✦</span><p><strong>Why this fits you</strong><br/>{niche.match_reason}</p></div>
    <h3>Skills roadmap</h3>
    <ol className="sw-skill-timeline">{skills.map(skill=><li key={skill.order}><span className={`sw-level-badge ${skill.level}`}>{skill.level}</span><div><strong>{skill.order}. {skill.name}</strong><p>{skill.description}</p></div></li>)}</ol>
    <div className="sw-actions"><button className="sw-button secondary" onClick={onClose}>Close</button></div>
  </dialog>;
}
