import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPracticeQuestionHandler} from '../server/practice-question-handler.js';

const flashcards=[{keyword:'Idempotency',explanation:'Repeating a request has the same effect as performing it once.'},{keyword:'Caching',explanation:'Store a reusable result to avoid repeated work.'}];
const question=keyword=>({keyword,question:'Which statement best describes this concept?',options:['The effect stays the same.','Every request creates another result.','All requests must fail.'],correct_answer:'The effect stays the same.',explanation:'Repeated execution has the same effect.'});
async function call({method='POST',token='Bearer alice-token',authStatus=200,dbStatus=200,cards=flashcards,providerStatus=200,key='server-secret',alter,body={user_id:'someone-else'},fetchError}={}) {
  const calls=[];
  const handler=createPracticeQuestionHandler({env:key?{DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:'deepseek-flash'}:{},chooseIndex:()=>0,fetchImpl:async(url,options)=>{
    calls.push({url,options});
    if(fetchError)throw fetchError;
    if(url.includes('/auth/v1/user'))return new Response(JSON.stringify({id:'alice'}),{status:authStatus});
    if(url.includes('/rest/v1/flashcards'))return new Response(JSON.stringify(cards),{status:dbStatus});
    const source=JSON.parse(JSON.parse(options.body).messages[1].content);
    const output=question(source.keyword);alter?.(output);
    return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}]}),{status:providerStatus});
  }});
  const result={headers:{},statusCode:200};
  const res={setHeader:(k,v)=>result.headers[k]=v,status:code=>{result.statusCode=code;return res;},json:body=>result.body=body};
  await handler({method,headers:{authorization:token},body},res);
  return {...result,calls};
}
test('practice requires a verified user before reading flashcards or calling DeepSeek',async()=>{
  const noToken=await call({token:''});assert.equal(noToken.statusCode,401);assert.equal(noToken.calls.length,0);
  const expired=await call({authStatus:401});assert.equal(expired.statusCode,401);assert.equal(expired.calls.length,1);
  assert.equal((await call({method:'GET'})).statusCode,405);
});
test('practice reads only the verified account under its JWT, ignoring submitted user IDs',async()=>{
  const result=await call();assert.equal(result.statusCode,200);
  const read=result.calls[1],url=new URL(read.url);
  assert.equal(url.searchParams.get('user_id'),'eq.alice');
  assert.equal(read.options.headers.Authorization,'Bearer alice-token');
  assert.equal(url.searchParams.get('select'),'keyword,explanation');
});
test('empty or unusable flashcards return Duy-compatible empty state without spending AI credits',async()=>{
  for(const cards of [[],[{keyword:'Empty',explanation:''}]]){
    const result=await call({cards});assert.equal(result.statusCode,422);assert.equal(result.body.code,'NO_FLASHCARDS');assert.equal(result.calls.length,2);
  }
});
test('database errors are visible and never turn into fabricated practice',async()=>{
  const result=await call({dbStatus:500});assert.equal(result.statusCode,502);assert.equal(result.calls.length,2);assert(!result.body.success);
});
test('uses the shared DeepSeek settings and sends only the selected saved card',async()=>{
  const result=await call();assert.equal(result.statusCode,200);assert.equal(result.body.success,true);assert.equal(result.body.options.length,3);
  const request=result.calls[2],payload=JSON.parse(request.options.body);
  assert.equal(request.url,'https://api.deepseek.com/chat/completions');
  assert.equal(request.options.headers.Authorization,'Bearer server-secret');assert.equal(payload.model,'deepseek-flash');
  assert.deepEqual(JSON.parse(payload.messages[1].content),flashcards[0]);
  assert(!JSON.stringify(result.body).includes('server-secret'));assert.equal(result.headers['Cache-Control'],'no-store');
});
test('missing keys and provider quota errors produce retryable errors without Gemini fallback',async()=>{
  const missing=await call({key:''});assert.equal(missing.statusCode,503);assert.equal(missing.body.code,'AI_NOT_CONFIGURED');assert.equal(missing.calls.length,2);
  const quota=await call({providerStatus:429});assert.equal(quota.statusCode,429);
  assert(quota.calls.every(c=>!c.url.includes('generativelanguage')&&!c.url.includes('generate-practice-question')));
});
test('rejects answers outside the options, duplicate options, and unrelated keywords',async()=>{
  for(const alter of [q=>q.correct_answer='not an option',q=>q.options[1]=q.options[0],q=>q.keyword='Unrelated',q=>q.options.push('Fourth answer')]){
    const result=await call({alter});assert.equal(result.statusCode,502);assert(!result.body.success);
  }
});
test('network timeouts report an error without disclosing request details',async()=>{
  const result=await call({fetchError:new DOMException('secret internal details','TimeoutError')});
  assert.equal(result.statusCode,504);assert(!JSON.stringify(result.body).includes('secret internal details'));
});
