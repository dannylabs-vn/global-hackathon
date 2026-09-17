import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareLearningPlan, assembleLearningPlan, todayInZone } from '../shared/learning-plan.js';
import { createLearningPlanHandler } from '../server/learning-plan-handler.js';
import { readLearningState, writeLearningState, emptyLearningState } from '../src/lib/learning-state.js';

const now = new Date('2026-09-17T01:00:00Z');
const input = () => ({career:{name:'Software Engineering',skills:[{name:'Programming',level:'beginner'}]},context:{
  timezone:'Asia/Bangkok',level:'beginner',pace:'steady',learningStyle:'projects',weeks:2,
  startDate:'2026-09-21',targetDate:'',currentSkills:'Basic HTML',goal:'Build a small personal website',constraints:'Free resources only',
  availability:[{day:1,start:'20:00',end:'20:20'},{day:4,start:'19:00',end:'21:00'}],
}});
function generated(prepared) {
  return {summary:'Build a website incrementally.',feasibility:'An initial project, not full career readiness.',
    milestones:[...new Set(prepared.slots.map(s=>s.week))].map(week=>({week,title:`Week ${week}`,outcome:'A working feature'})),
    sessions:prepared.slots.map(slot=>({slotId:slot.id,title:'Build a page',skill:'HTML',objective:'Create a semantic page',activity:'Write and test a semantic HTML page.',deliverable:'A page with a heading and navigation',question:{prompt:'Which tag represents the main heading?',options:['h1','p','span','div'],correctIndex:0,explanation:'h1 identifies the primary heading.'}})),
  };
}
test('schedule respects chosen weekdays, shorter windows, pace and plan length',()=>{
  const {slots}=prepareLearningPlan(input(),now);
  assert.deepEqual(slots.map(s=>[s.date,s.start,s.end,s.minutes,s.week]),[
    ['2026-09-21','20:00','20:20',20,1],['2026-09-24','19:00','19:45',45,1],
    ['2026-09-28','20:00','20:20',20,2],['2026-10-01','19:00','19:45',45,2],
  ]);
});
test('deadline truncates schedule and never creates sessions after the deadline',()=>{
  const body=input();body.context.targetDate='2026-09-24';
  assert.deepEqual(prepareLearningPlan(body,now).slots.map(s=>s.date),['2026-09-21','2026-09-24']);
});
test('rejects impossible dates, duplicate days, backwards windows and empty availability',()=>{
  for(const patch of [{startDate:'2026-02-30'},{timezone:'invalid'},{availability:[]},{weeks:5},{targetDate:'2026-09-20'},
    {availability:[{day:1,start:'22:00',end:'01:00'}]},
    {availability:[{day:1,start:'19:00',end:'20:00'},{day:1,start:'20:00',end:'21:00'}]}]) {
    const body=input();Object.assign(body.context,patch);assert.throws(()=>prepareLearningPlan(body,now));
  }
});
test('uses the user timezone at date boundaries and skips elapsed sessions today',()=>{
  assert.equal(todayInZone('Asia/Bangkok',new Date('2026-09-17T18:00:00Z')),'2026-09-18');
  const body=input();Object.assign(body.context,{startDate:'2026-09-17',availability:[{day:4,start:'07:00',end:'08:00'}]});
  assert.equal(prepareLearningPlan(body,now).slots[0].date,'2026-09-24');
  assert.throws(()=>prepareLearningPlan(body,new Date('2026-09-17T18:00:00Z')),/today or later/);
});
test('wall-clock availability stays unchanged across a daylight saving boundary',()=>{
  const body=input();Object.assign(body.context,{timezone:'America/New_York',startDate:'2026-10-26',availability:[{day:1,start:'19:00',end:'20:00'}]});
  assert.deepEqual(prepareLearningPlan(body,now).slots.map(s=>[s.date,s.start]),[['2026-10-26','19:00'],['2026-11-02','19:00']]);
});
test('AI cannot move sessions outside validated slots; missing and duplicate sessions are rejected',()=>{
  const prepared=prepareLearningPlan(input(),now), output=generated(prepared);
  output.sessions[0].date='2040-01-01';output.sessions[0].start='00:00';
  assert.equal(assembleLearningPlan(prepared,output,'plan',now).sessions[0].date,'2026-09-21');
  assert.equal(assembleLearningPlan(prepared,output,'plan',now).sessions[0].start,'20:00');
  output.sessions[1].slotId=output.sessions[0].slotId;
  assert.throws(()=>assembleLearningPlan(prepared,output,'plan',now),/mismatched/);
});
test('rejects incomplete milestones and unanswerable AI questions',()=>{
  const prepared=prepareLearningPlan(input(),now), output=generated(prepared);
  output.sessions[0].question.correctIndex=4;
  assert.throws(()=>assembleLearningPlan(prepared,output,'plan',now),/invalid practice/);
  output.sessions[0].question.correctIndex=0;output.milestones.pop();
  assert.throws(()=>assembleLearningPlan(prepared,output,'plan',now),/milestones/);
});
test('plans and progress persist separately for different signed-in accounts',()=>{
  const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
  const prepared=prepareLearningPlan(input(),now),plan=assembleLearningPlan(prepared,generated(prepared),'plan',now);
  writeLearningState(storage,'alice',{plan,progress:{'session-1':{done:true,note:'Created my page'}},reviews:{}});
  assert.equal(readLearningState(storage,'alice').progress['session-1'].done,true);
  assert.deepEqual(readLearningState(storage,'bob'),emptyLearningState());
});

async function call({body=input(),method='POST',token='Bearer test-token',key='test-provider-key',authStatus=200,providerStatus=200,alter}={}) {
  const calls=[];
  const handler=createLearningPlanHandler({env:key?{DEEPSEEK_API_KEY:key}:{},now:()=>now,fetchImpl:async (url,options)=>{
    calls.push({url,options});
    if(url.includes('/auth/v1/user'))return new Response(JSON.stringify(authStatus===200?{id:'test-user'}:{error:'invalid'}),{status:authStatus});
    const prepared=JSON.parse(JSON.parse(options.body).messages[1].content);
    const output=generated(prepared);alter?.(output);
    return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}]}),{status:providerStatus});
  }});
  const result={headers:{},statusCode:200};
  const res={setHeader:(k,v)=>result.headers[k]=v,status:code=>{result.statusCode=code;return res;},json:body=>result.body=body};
  await handler({method,headers:{authorization:token},body},res);
  return {...result,calls};
}
test('API denies missing or expired sessions without calling the AI provider',async()=>{
  const missing=await call({token:''});assert.equal(missing.statusCode,401);assert.equal(missing.calls.length,0);
  const expired=await call({authStatus:401});assert.equal(expired.statusCode,401);assert.equal(expired.calls.length,1);
});
test('API rejects invalid input before spending AI credits',async()=>{
  const body=input();body.context.availability=[];
  const invalid=await call({body});assert.equal(invalid.statusCode,400);assert.equal(invalid.calls.length,0);
  assert.equal((await call({method:'GET'})).statusCode,405);
});
test('API returns an explicit setup error when DeepSeek is not configured',async()=>{
  const result=await call({key:''});assert.equal(result.statusCode,503);assert.equal(result.body.code,'AI_NOT_CONFIGURED');assert.equal(result.calls.length,1);
});
test('API generates validated personalized content and never returns the server key',async()=>{
  const result=await call();assert.equal(result.statusCode,200);assert.equal(result.body.plan.sessions.length,4);
  assert.equal(result.body.plan.context.constraints,'Free resources only');
  assert.equal(result.calls[1].url,'https://api.deepseek.com/chat/completions');
  assert.equal(result.calls[1].options.headers.Authorization,'Bearer test-provider-key');
  assert(!JSON.stringify(result.body).includes('test-provider-key'));assert.equal(result.headers['Cache-Control'],'no-store');
});
test('AI quota errors and malformed output never become pretend successful plans',async()=>{
  assert.equal((await call({providerStatus:429})).statusCode,429);
  const bad=await call({alter:output=>output.sessions.pop()});assert.equal(bad.statusCode,502);assert(!bad.body.plan);
});
