export class ServiceError extends Error {
  constructor(status, message, code) { super(message); this.status=status; this.code=code; }
}

// One provider configuration for roadmap generation and flashcard practice.
export async function deepseekJson({fetchImpl=fetch,env=process.env,system,input,maxTokens=16000,timeoutMs=105000}) {
  const key=env.DEEPSEEK_API_KEY;
  if(!key)throw new ServiceError(503,'AI generation is not configured yet. Please try again after setup is complete.','AI_NOT_CONFIGURED');
  const model=env.DEEPSEEK_MODEL || 'deepseek-flash';
  if(!/^[a-zA-Z0-9._-]+$/.test(model))throw new ServiceError(503,'The AI model configuration needs to be corrected.');
  const response=await fetchImpl('https://api.deepseek.com/chat/completions',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(timeoutMs),
    body:JSON.stringify({model,response_format:{type:'json_object'},max_tokens:maxTokens,stream:false,thinking:{type:'disabled'},messages:[
      {role:'system',content:system},{role:'user',content:JSON.stringify(input)},
    ]}),
  });
  if(!response.ok)throw new ServiceError(response.status===429?429:502,response.status===429?'The AI service is busy or its quota is exhausted. Please try again later.':'The AI provider could not generate this content. Please retry.');
  const payload=await response.json(),candidate=payload.choices?.[0];
  if(candidate?.finish_reason!=='stop')throw new ServiceError(502,'AI could not finish the response. Please try again.');
  try { return JSON.parse(candidate.message.content); }
  catch { throw new ServiceError(502,'AI returned an incomplete response. Please try again.'); }
}

export function sendServiceError(res,error) {
  if(error instanceof ServiceError)return res.status(error.status).json({error:error.message,...(error.code?{code:error.code}:{})});
  const timeout=['TimeoutError','AbortError'].includes(error.name);
  return res.status(timeout?504:502).json({error:timeout?'Generation took too long. Please retry.':'Could not reach the learning service. Please retry.'});
}
