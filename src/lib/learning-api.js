import { supabase } from './supabase.js';

export async function generateLearningPlan(input, signal) {
  const { data:{session}, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error('Sign in again before generating your roadmap.');
  const response = await fetch('/api/learning-plan', {
    method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
    body:JSON.stringify(input), signal,
  });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The roadmap service is not available on this deployment. Please refresh or try again after deployment finishes.');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not generate your roadmap. Please retry.');
  if (!data.plan?.sessions?.length) throw new Error('The AI service returned an empty roadmap. Please retry.');
  return data.plan;
}
