import React, { useEffect, useState } from 'react';
import './SkillWorkspace.css';
import { FlashcardPractice, usePracticeQuiz } from './FlashcardPractice.jsx';
import { useLearningJourney, PlanQuestionnaire, LearningRoadmap, RoadmapPractice } from './LearningJourney.jsx';
import { signOut } from '../lib/auth.js';
import { analyzeCareer, getCareerReports, getBookmarks, deleteBookmark, getAnalyticsData, getFlashcards } from '../lib/api.js';

const navigation = [['map','◈','Skill map'],['roadmap','⌁','Career Analysis'],['practice','\u2726','Practice'],['highlights','▤','Bookmark'],['flashcards','✎','Highlight'],['profile','◎','Profile']];
const status = value => value >= 55 ? 'Growing' : value >= 40 ? 'At-risk' : 'Foundational';
const currentView = () => [...navigation.map(n=>n[0]),'session'].includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'map';
const formatDate = iso => { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); } catch { return ''; } };
const hostnameOf = url => { if (!url) return ''; try { return new URL(url).hostname; } catch { return url; } };
const bookmarkAnalysis = b => Array.isArray(b.bookmark_analysis) ? b.bookmark_analysis[0] : b.bookmark_analysis;
const safeSource = value => { try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : null; } catch { return null; } };
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

export function SkillWorkspace({ user }) {
  const [view,setView] = useState(currentView);
  const journey = useLearningJourney(user.id);
  const quiz = usePracticeQuiz(view==='practice');
  const [roadmapFocus,setRoadmapFocus] = useState('');
  const planningContext = roadmapFocus ? {...journey.plan?.context,constraints:[journey.plan?.context.constraints,`Include practice on the saved keyword: ${roadmapFocus}.`].filter(Boolean).join('\n')} : journey.plan?.context;
  function addPracticeTopic(keyword) { setRoadmapFocus(keyword); go('roadmap'); if(journey.plan) setSelectedNiche(journey.plan.career); setNotice(`Choose or confirm a career to include ${keyword} in your next personalized plan.`); }
  const [practiceSessionId,setPracticeSessionId] = useState(null);
  function openPractice(id) { setPracticeSessionId(id || journey.plan?.sessions.find(s=>!journey.progress[s.id]?.done)?.id || journey.plan?.sessions[0]?.id); go('session'); }
  function saveLearningPlan(plan) { journey.savePlan(plan); setRoadmapFocus(''); setSelectedNiche(null); go('roadmap'); setNotice('Your personal roadmap is ready. Open a session to start practicing.'); }
  const [notice,setNotice] = useState('');
  const [search,setSearch] = useState('');
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
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Your account';
  const highlights = flashcards.map(card => ({ title:card.keyword, source:hostnameOf(card.source_url), quote:card.explanation }));
  function go(next) { window.location.hash=next; setView(next); setNotice(''); }
  function exportData() { const url=URL.createObjectURL(new Blob([JSON.stringify({exported_at:new Date().toISOString(),bookmarks,flashcards,career_reports:reports,learning_plan:journey.plan,practice_progress:journey.progress,flashcard_reviews:journey.reviews,practice_answered_count:quiz.answeredCount},null,2)],{type:'application/json'})); const a=document.createElement('a'); a.href=url; a.download='skillmark-workspace.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); setNotice('Your workspace has been exported.'); }
  async function handleSignOut() { const {error}=await signOut(); if(error){setNotice(error.message);return;} window.location.href='/'; }
  async function loadReports() {
    setReportsLoading(true);
    const { data, error } = await getCareerReports(user.id);
    setReportsLoading(false);
    if (error || !data) { setAnalyzeError(error?.message || 'Could not load career reports.'); return; }
    setReports(data);
    if (data.length) {
      try {
        const parsed = (typeof data[0].report_text === 'string' ? JSON.parse(data[0].report_text) : data[0].report_text);
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
    if (error || data?.error) { setAnalyzeError(error?.message||data?.error||'Could not analyze your career path right now. Please try again.'); return; }
    setNiches(data?.niches||[]);
    setTopTopics(data?.top_topics||[]);
    setAnalyzedAt(data?.analyzed_at||new Date().toISOString());
    loadReports();
  }
  function openReport(report) {
    try {
      const parsed = (typeof report.report_text === 'string' ? JSON.parse(report.report_text) : report.report_text);
      setNiches(parsed.niches||[]);
      setTopTopics(parsed.top_topics||[]);
      setAnalyzedAt(parsed.analyzed_at||report.created_at);
      setAnalyzeError('');
    } catch { setAnalyzeError('Could not read this report.'); }
  }
  async function loadBookmarks() {
    setBookmarksError('');
    setBookmarksLoading(true);
    const { data, error } = await getBookmarks(user.id);
    setBookmarksLoading(false);
    if (error) { setBookmarksError(error.message||'Could not load bookmarks.'); return; }
    setBookmarks(data||[]);
  }
  async function handleDeleteBookmark(id) {
    const { error } = await deleteBookmark(id,user.id);
    if (error) { setBookmarksError(error.message||'Could not delete this bookmark.'); return; }
    setBookmarks(items=>items.filter(item=>item.id!==id));
    setNotice('Bookmark removed.');
  }
  async function loadAnalytics() {
    setAnalyticsLoading(true);
    const { data, error } = await getAnalyticsData(user.id);
    setAnalyticsLoading(false);
    if (error || !data) { setBookmarksError(error?.message || 'Could not load reading analytics.'); return; }
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
    setFlashcardsError('');
    setFlashcardsLoading(true);
    const { data, error } = await getFlashcards(user.id);
    setFlashcardsLoading(false);
    if (error) { setFlashcardsError(error.message||'Could not load flashcards.'); return; }
    setFlashcards(data||[]);
  }
  useEffect(()=>{document.documentElement.lang='en';document.title='Your learning workspace · Skillmark';},[]);
  useEffect(()=>{const sync=()=>{setView(currentView());setNotice('');};window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
  useEffect(()=>{document.querySelector('.sw-main')?.focus(); window.scrollTo(0,0);},[view]);
  useEffect(()=>{ if (view==='roadmap' && !reportsLoaded) { setReportsLoaded(true); loadReports(); } },[view,reportsLoaded]);
  useEffect(()=>{
    loadBookmarks(); loadFlashcards(); loadReports();
    const refresh = () => { if (!document.hidden) { loadBookmarks(); loadAnalytics(); loadFlashcards(); } };
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 10000);
    return () => { window.removeEventListener('focus', refresh); clearInterval(timer); };
  },[view]);
  useEffect(()=>{ if (view==='map' && !analyticsLoaded) { setAnalyticsLoaded(true); loadAnalytics(); } },[view,analyticsLoaded]);
  useEffect(()=>{ if (view==='flashcards' && !flashcardsLoaded) { setFlashcardsLoaded(true); loadFlashcards(); } },[view,flashcardsLoaded]);
  const heading = (eyebrow,title,description,actions) => <header className="sw-heading"><div><p className="sw-eyebrow">{eyebrow}</p><h1>{title}<span>.</span></h1><p>{description}</p></div><div className="sw-actions">{actions}</div></header>;
  const button = (label,action,secondary=false,disabled=false) => <button className={`sw-button ${secondary?'secondary':''}`} onClick={action} disabled={disabled}>{label}</button>;
  return <div className="sw-app">
    <aside className="sw-sidebar"><a href="/" className="site-brand"><span className="brand-skill">Skill</span><span className="brand-mark">mark.</span></a><p className="sw-eyebrow">YOUR WORKSPACE</p><nav aria-label="Workspace">{navigation.map(([id,icon,label])=><button key={id} onClick={()=>go(id)} aria-current={view===id?'page':undefined}><span aria-hidden="true">{icon}</span>{label}{id==='highlights'&&<small>{bookmarks.length}</small>}</button>)}</nav><div className="sw-sidebar-note"><span>✦</span><strong>A little curiosity.<br/>A clearer direction.</strong><p>Turn what you read into what you do next.</p><a href="/">Back to the website ↗</a></div><button className="sw-person" onClick={()=>go('profile')}><span className="sw-avatar">{name.trim().split(/\s+/).map(s=>s[0]).slice(0,2).join('')}</span><span><strong>{name}</strong><small>Your learning space</small></span><span>↗</span></button></aside>
    <div className="sw-body"><div className="sw-topbar"><span>Workspace <span>/</span> <strong>{navigation.find(n=>n[0]===view)?.[2]||(view==='session'?'Roadmap session':'Workspace')}</strong></span><div className="sw-actions"><button className="sw-link" onClick={()=>{loadBookmarks();loadFlashcards();loadAnalytics();loadReports();}}>Refresh data</button><a className="sw-link" href="/extension">Set up extension</a></div></div><main key={view} className="sw-main" tabIndex={-1}>{journey.storageError&&<div className="sw-notice sw-notice-error" role="alert">{journey.storageError}</div>}{view==='map'&&(bookmarksError||flashcardsError||analyzeError)&&<div className="sw-notice sw-notice-error" role="alert">{bookmarksError||flashcardsError||analyzeError}</div>}{notice&&<div className="sw-notice" role="status">✓ {notice}<button aria-label="Dismiss notification" onClick={()=>setNotice('')}>×</button></div>}
    {view==='map'&&<>{heading('FOLLOW YOUR CURIOSITY','Your reading map','A little more clarity on what to explore next.',<>{button('Export',exportData,true)}{button('Career analysis ↗',()=>go('roadmap'))}</>)}<div className="sw-stats"><div><span className="sw-stat-icon">◈</span><div><strong>{topicStats.length}</strong><span>topics from your bookmarks</span></div></div><div><span className="sw-stat-icon">▤</span><div><strong>{highlights.length}</strong><span>saved highlights</span></div></div><div><span className="sw-stat-icon">✦</span><div><strong>{reports.length}</strong><span>career reports</span></div></div></div><div className="sw-map-grid"><section className="sw-panel sw-signal"><div className="sw-panel-title"><h2>Signal mix</h2><span>By domain category</span></div><div className="sw-donut" role="img" aria-label={domainStats.length?domainStats.map(([l,v])=>`${v} ${l}`).join(', '):'No bookmarks analyzed yet'} style={{background:buildConicGradient(domainStats)}}><div><strong>{domainStats.reduce((sum,[,v])=>sum+v,0)}</strong><span>bookmarks analyzed</span></div></div><div className="sw-legend">{domainStats.length?domainStats.map(([label,value],i)=><div key={label}><i style={{background:DOMAIN_COLORS[i%DOMAIN_COLORS.length]}}/><span>{label}</span><strong>{value}</strong></div>):<p className="sw-small">No bookmarks analyzed yet.</p>}</div><p className="sw-small">A starting point for exploration, not a measure of your ability.</p></section><section className="sw-panel sw-coverage"><div className="sw-panel-title"><h2>Top reading topics</h2><button className="sw-link" onClick={()=>setReverse(!reverse)}>{reverse?'Lowest first':'Highest first'} ↓</button></div>{(()=>{const maxCount=Math.max(1,...topicStats.map(([,c])=>c));const rows=topicStats.map(([title,count])=>[title,Math.round((count/maxCount)*100)]);return [...rows].sort((a,b)=>reverse?a[1]-b[1]:b[1]-a[1]).map(([title,value])=><button className="sw-skill" key={title} onClick={()=>{go('roadmap');}} aria-label={`Explore career paths related to ${title}`}><span>{title}<b>{value}%</b></span><span className="sw-track"><span className={status(value).toLowerCase()} style={{width:`${value}%`}}/></span></button>);})()}{!topicStats.length&&<p className="sw-small">No topics yet — save a few bookmarks to see your top topics here.</p>}<div className="sw-insight"><span>↗</span><p><strong>Curiosity becomes momentum.</strong><br/>Explore career paths from your saved reading.</p></div></section><aside className="sw-right"><section className="sw-activity"><p className="sw-eyebrow">A WEEK OF SMALL DISCOVERIES</p><div className="sw-bars" aria-label="Bookmarks saved per day, last 7 days">{(()=>{const {counts,labels}=computeWeekly(bookmarks);const maxCount=Math.max(1,...counts);return counts.map((c,i)=><div key={i}><span style={{height:`${Math.round((c/maxCount)*100)}%`}}/><small>{labels[i]}</small></div>);})()}</div><p className="sw-small">Last 7 days</p></section><section className="sw-focus"><span className="sw-eyebrow">YOUR NEXT SMALL STEP</span><h2>Make room for<br/>a new perspective.</h2><p>Analyze the topics in your saved pages to explore possible career directions.</p><button className="sw-link" onClick={()=>go('roadmap')}>Give it a try <span>↗</span></button></section><section className="sw-recent"><div className="sw-panel-title"><h2>Recent highlights</h2><button className="sw-link" onClick={()=>go('flashcards')}>View all</button></div>{highlights.slice(0,3).map(h=><button key={h.title} onClick={()=>go('flashcards')}><span>▤</span><div><strong>{h.title}</strong><small>{h.source}</small></div><span>↗</span></button>)}{!highlights.length&&<p>No saved explanations yet. Save a flashcard with the extension to see it here.</p>}</section></aside></div></>}
    {view==='practice'&&<FlashcardPractice quiz={quiz} onAddToRoadmap={addPracticeTopic}/>}
    {view==='session'&&<RoadmapPractice {...journey} initialSessionId={practiceSessionId} onCareer={()=>go('roadmap')}/>}
    {view==='roadmap'&&<>{heading('CAREER PATH ANALYSIS','Career Path Analysis','Suggestions based on the pages you have saved.',button(analyzing?'Analyzing…':niches.length?'Re-analyze':'Analyze my career path',handleAnalyze,false,analyzing))}
    {analyzeError&&<div className="sw-notice sw-notice-error" role="alert">⚠ {analyzeError}<button aria-label="Dismiss error" onClick={()=>setAnalyzeError('')}>×</button></div>}
    <LearningRoadmap plan={journey.plan} progress={journey.progress} onPractice={openPractice} onEdit={()=>setSelectedNiche(journey.plan.career)}/>
    <div className="sw-two-col"><div>
    <section className="sw-panel sw-niche-list"><div className="sw-panel-title"><h2>Top matching paths</h2>{analyzedAt&&<span>Updated {formatDate(analyzedAt)}</span>}</div>
    {niches.length?niches.map((niche,i)=><button type="button" className="sw-road-row sw-niche-row" key={niche.id||niche.name} onClick={()=>setSelectedNiche(niche)}><span className="sw-step">{i+1}</span><div><h3>{niche.name}</h3><p>{niche.match_reason}</p><span className="sw-track"><span className={status(niche.match_percent||0).toLowerCase()} style={{width:`${niche.match_percent||0}%`}}/></span></div><span className="sw-tag">{niche.match_percent}% match</span></button>)
    :<div className="sw-empty"><h2>No analysis yet</h2><p>Save a few pages while you browse, then run your first career path analysis to see your top 5 matches.</p>{button(analyzing?'Analyzing…':'Analyze my career path',handleAnalyze,false,analyzing)}</div>}
    </section>
    <section className="sw-panel sw-recent sw-report-history"><div className="sw-panel-title"><h2>Previous reports</h2></div>
    {reportsLoading?<p className="sw-small">Loading history…</p>:reports.length?reports.slice(0,6).map(r=><button key={r.id} onClick={()=>openReport(r)}><span>◎</span><div><strong>{formatDate(r.created_at)}</strong><small>{(r.suggested_paths||[]).slice(0,3).join(' · ')||'—'}</small></div><span>↗</span></button>):<p className="sw-small">No previous reports yet.</p>}
    </section>
    </div><aside className="sw-focus"><p className="sw-eyebrow">HOW THIS WORKS</p><h2>Built from<br/>what you save.</h2><p>Your saved pages are analyzed to suggest relevant career directions.</p>{topTopics.length>0&&<div className="sw-topic-chips">{topTopics.slice(0,8).map(t=><span className="sw-tag" key={t}>{t}</span>)}</div>}</aside></div></>}
    {view==='highlights'&&<>{heading('KEEP WHAT MAKES YOU THINK','Your bookmarks','Small discoveries, collected in one place.')}
    {bookmarksError&&<div className="sw-notice sw-notice-error" role="alert">⚠ {bookmarksError}<button aria-label="Dismiss error" onClick={()=>setBookmarksError('')}>×</button></div>}
    {bookmarksLoading?<p className="sw-small">Loading bookmarks…</p>:bookmarks.length===0?<div className="sw-empty"><h2>Chưa có bookmark nào.</h2><p>Dùng extension để lưu trang web bạn quan tâm.</p></div>:<>
    <label className="sw-search">Search bookmarks<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search saved pages…" type="search"/></label>
    <div className="sw-highlight-grid">{bookmarks.filter(b=>((b.title||'')+' '+(bookmarkAnalysis(b)?.summary||'')).toLowerCase().includes(search.toLowerCase())).map(b=><article className="sw-panel" key={b.id}><span className="sw-tag">{bookmarkAnalysis(b)?.domain_category||b.status}</span><blockquote>“{bookmarkAnalysis(b)?.summary||(b.status==='pending'?'Analyzing…':b.status==='failed'?'Analysis failed.':'No summary yet.')}”</blockquote><p className="sw-small">{b.title||b.url} · {formatDate(b.created_at)}</p><div className="sw-actions"><a className="sw-link" href={safeSource(b.url) || undefined} target="_blank" rel="noopener noreferrer">Open source</a><button className="sw-link" onClick={()=>handleDeleteBookmark(b.id)}>Remove</button></div></article>)}</div>
    {!bookmarks.some(b=>((b.title||'')+' '+(bookmarkAnalysis(b)?.summary||'')).toLowerCase().includes(search.toLowerCase()))&&<div className="sw-empty"><h2>No bookmarks found.</h2><p>Try another search or save a page with the extension.</p></div>}
    </>}</>}
    {view==='flashcards'&&<>{heading('SAVE WHAT YOU LEARN','Your flashcards','Keywords you highlighted and had explained on the web, saved here to review.')}
    {flashcardsError&&<div className="sw-notice sw-notice-error" role="alert">⚠ {flashcardsError}<button aria-label="Dismiss error" onClick={()=>setFlashcardsError('')}>×</button></div>}
    {flashcardsLoading?<p className="sw-small">Loading flashcards…</p>:flashcards.length===0?<div className="sw-empty"><h2>No flashcards yet.</h2><p>Highlight a word on any page with the extension (Ctrl+Shift+E) and save it as a flashcard.</p></div>:
    <div className="sw-highlight-grid">{flashcards.map(f=><article className="sw-panel" key={f.id}><span className="sw-tag">{f.keyword}</span><blockquote>“{f.explanation||'No explanation saved.'}”</blockquote><p className="sw-small">{hostnameOf(f.source_url)||'Unknown source'} · {formatDate(f.created_at)}</p></article>)}</div>}
    </>}
    {view==='profile'&&<>{heading('YOUR ACCOUNT','Your account','The account connected to your saved reading.')}<div className="sw-two-col"><section className="sw-panel"><h2>{name}</h2><p>{user?.email}</p><p className="sw-small">Joined {formatDate(user?.created_at)}</p><div className="sw-actions">{button('Export saved data',exportData,true)}<button className="sw-link" onClick={handleSignOut}>Sign out</button></div></section><section className="sw-focus"><h2>Your reading.<br/>Your data.</h2><p>Use this same account in the extension to sync your bookmarks and flashcards.</p><p>Only pages and terms you choose to save are sent for analysis.</p><a className="sw-link" href="/privacy">Privacy policy</a></section></div></>}
    <footer className="sw-footer"><span>Skillmark · A little learning. A clearer you.</span><a href="/">Made for your curiosity ↗</a></footer></main></div>
    {selectedNiche&&<NicheDetailDialog niche={selectedNiche} previousContext={planningContext} onGenerated={saveLearningPlan} onClose={()=>setSelectedNiche(null)}/>}
  </div>;
}
function NicheDetailDialog({ niche, previousContext, onGenerated, onClose }) {
  const [following,setFollowing] = useState(false);
  const ref = React.useRef(null);
  useEffect(() => { const previous = document.activeElement; ref.current.showModal(); return () => previous?.focus(); }, []);
  const skills = [...(niche.skills||[])].map((skill,index)=>typeof skill==='string'?{name:skill,order:index+1}:({...skill,order:skill.order||index+1})).sort((a,b)=>(a.order||0)-(b.order||0));
  return <dialog ref={ref} className="sw-dialog sw-niche-dialog" onCancel={onClose} aria-labelledby="niche-dialog-title">
    <button className="sw-icon-close" aria-label="Close" onClick={onClose}>×</button>
    <p className="sw-eyebrow">{Number.isFinite(niche.match_percent)?`${niche.match_percent}% MATCH`:'YOUR CHOSEN PATH'}</p>
    <h2 id="niche-dialog-title">{niche.name}</h2>
    {following?<PlanQuestionnaire career={niche} previousContext={previousContext} onGenerated={onGenerated} onBack={()=>setFollowing(false)}/>:<>
    <p>{niche.description}</p>
    <div className="sw-niche-reason"><span>✦</span><p><strong>Why this fits you</strong><br/>{niche.match_reason}</p></div>
    <h3>Skills to develop</h3>
    <ol className="sw-skill-timeline">{skills.map(skill=><li key={skill.order}><span className={`sw-level-badge ${skill.level}`}>{skill.level}</span><div><strong>{skill.order}. {skill.name}</strong><p>{skill.description}</p></div></li>)}</ol>
    {!skills.length&&<p>Confirm this path to build a skill plan around your experience and goals.</p>}
    <div className="sw-actions"><button className="sw-button" onClick={()=>setFollowing(true)}>Confirm — I want to follow this path</button><button className="sw-button secondary" onClick={onClose}>Close</button></div></>}
  </dialog>;
}
