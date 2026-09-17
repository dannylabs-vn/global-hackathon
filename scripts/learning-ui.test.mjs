import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { prepareLearningPlan, assembleLearningPlan, todayInZone } from '../shared/learning-plan.js';

test('career confirmation, questionnaire, real plan practice and per-account persistence',async()=>{
  const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost/learn#roadmap'});
  const globals=['window','document','navigator','localStorage','HTMLElement','HTMLDialogElement','IS_REACT_ACT_ENVIRONMENT'];
  const originals=Object.fromEntries(globals.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const key of globals)Object.defineProperty(globalThis,key,{value:key==='IS_REACT_ACT_ENVIRONMENT'?true:dom.window[key],writable:true,configurable:true});
  dom.window.scrollTo=()=>{};
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  const React=await import('react');
  const {createRoot}=await import('react-dom/client');
  const {act}=React;
  const server=await createServer({server:{middlewareMode:true},appType:'custom'});
  const originalFetch=globalThis.fetch;
  let root, authClient;
  try {
    const {SkillWorkspace}=await server.ssrLoadModule('/src/components/SkillWorkspace.jsx');
    const {supabase}=await server.ssrLoadModule('/src/lib/supabase.js');
    authClient=supabase.auth;
    const career={name:'Software Engineering',description:'Build and maintain software.',match_percent:80,match_reason:'Based on your saved reading.',skills:[{name:'Programming',description:'Build small programs.',level:'beginner',order:1}]};
    const tables={career_reports:[{id:'report',created_at:new Date().toISOString(),report_text:JSON.stringify({niches:[career]})}],flashcards:[{id:'card',keyword:'Idempotency',explanation:'Repeating an operation has the same effect.',created_at:new Date().toISOString()}]};
    supabase.auth.getSession=async()=>({data:{session:{access_token:'test-token'}},error:null});
    supabase.from=table=>{const query={select:()=>query,eq:()=>query,order:()=>query,then:resolve=>Promise.resolve(resolve({data:tables[table]||[],error:null}))};return query;};
    let requestBody,failGeneration=false;
    globalThis.fetch=async (url,options)=>{
      assert.equal(url,'/api/learning-plan');assert.equal(options.headers.Authorization,'Bearer test-token');
      if(failGeneration)return new Response(JSON.stringify({error:'AI quota exhausted. Retry later.'}),{status:429,headers:{'Content-Type':'application/json'}});
      requestBody=JSON.parse(options.body);
      const prepared=prepareLearningPlan(requestBody);
      const output={summary:'Your personalized website plan.',feasibility:'Build foundations first.',
        milestones:[...new Set(prepared.slots.map(s=>s.week))].map(week=>({week,title:'Build foundations',outcome:'Create a working page'})),
        sessions:prepared.slots.map(s=>({slotId:s.id,title:'Build a semantic page',skill:'HTML',objective:'Use headings meaningfully',activity:'Create a page with a main heading and navigation.',deliverable:'A working HTML page',question:{prompt:'Which tag is the main heading?',options:['h1','p','span','div'],correctIndex:0,explanation:'h1 represents the primary heading.'}})),
      };
      const plan=assembleLearningPlan(prepared,output,'generated-plan');
      return new Response(JSON.stringify({plan}),{status:200,headers:{'Content-Type':'application/json'}});
    };
    root=createRoot(document.getElementById('root'));
    const user={id:'alice',email:'alice@example.invalid',user_metadata:{}};
    const settle=()=>new Promise(resolve=>setTimeout(resolve,10));
    async function click(text) {
      const button=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(text));
      assert(button,`Expected button: ${text}`);assert(!button.disabled,`Disabled button: ${text}`);
      await act(async()=>{button.click();await settle();});
    }
    async function enter(element,value) {
      assert(element,'Expected form input');
      const prototype=element.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:element.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype;
      await act(async()=>{Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,value);element.dispatchEvent(new dom.window.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));await settle();});
    }
    const labelInput=text=>[...document.querySelectorAll('label')].find(label=>label.textContent.includes(text))?.querySelector('input,textarea,select');
    await act(async()=>{root.render(React.createElement(SkillWorkspace,{user,key:user.id}));await settle();});
    await click('Software Engineering');
    assert(document.querySelector('dialog[open]').textContent.includes('Programming'));
    await click('I want to follow this path');
    await enter(labelInput('What do you want to achieve?'),'Build a portfolio website');
    await enter(labelInput('Anything else to plan around?'),'Free resources, evenings only');
    await enter(labelInput('Initial plan length'),'1');
    const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
    const start=todayInZone(Intl.DateTimeFormat().resolvedOptions().timeZone,tomorrow);
    await enter(labelInput('Start date'),start);
    await act(async()=>{document.querySelector('.lj-day input[type=checkbox]').click();await settle();});
    assert(document.querySelector('.lj-capacity'));
    await act(async()=>{document.querySelector('.lj-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await settle();});
    assert.equal(requestBody.context.goal,'Build a portfolio website');
    assert.equal(requestBody.context.constraints,'Free resources, evenings only');
    assert(document.querySelector('.lj-roadmap').textContent.includes('Your personalized website plan.'));
    assert(!document.querySelector('dialog'));
    await click('Start practicing');
    assert(document.body.textContent.includes('Which tag is the main heading?'));
    await act(async()=>{document.querySelector('input[type=radio]').click();await settle();});
    await click('Check my answer');
    assert(document.querySelector('.sw-feedback').textContent.includes('Correct'));
    await enter(document.querySelector('.lj-reflection textarea'),'Built my portfolio heading and navigation.');
    await click('I completed this session');
    let saved=JSON.parse(window.localStorage.getItem('skillmark:learning:v1:alice'));
    assert.equal(saved.progress['session-1'].done,true);
    await click('Career Analysis');await click('Adjust my plan');await click('I want to follow this path');
    failGeneration=true;
    await act(async()=>{document.querySelector('.lj-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await settle();});
    assert(document.querySelector('dialog').textContent.includes('AI quota exhausted'));
    saved=JSON.parse(window.localStorage.getItem('skillmark:learning:v1:alice'));
    assert.equal(saved.plan.id,'generated-plan');assert.equal(saved.progress['session-1'].done,true);
    await act(async()=>{root.render(React.createElement(SkillWorkspace,{user:{...user,id:'bob',email:'bob@example.invalid'},key:'bob'}));await settle();});
    assert(!document.querySelector('.lj-roadmap'),'Another account must not see Alice\'s plan');
    await click('Practice');await click('My flashcards');await click('Reveal explanation');
    assert(document.body.textContent.includes('Repeating an operation has the same effect.'));
    await click('I remembered it');
    assert.equal(JSON.parse(window.localStorage.getItem('skillmark:learning:v1:bob')).reviews.card.value,'remembered');
  } finally {
    if(root)await act(async()=>root.unmount());
    await authClient?.dispose();
    globalThis.fetch=originalFetch;
    await server.close();dom.window.close();
    for(const key of globals){if(originals[key])Object.defineProperty(globalThis,key,originals[key]);else delete globalThis[key];}
  }
});
