import { ServiceError } from './deepseek.js';

export const SUPABASE_URL='https://kfdmduogwpgolhybqeez.supabase.co';
// Public client key. Requests also require the user's verified access token.
const PUBLIC_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZG1kdW9nd3Bnb2xoeWJxZWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0Nzg4OTQsImV4cCI6MjEwNTA1NDg5NH0.lnT7Fiii9mABkyze2OnLIZ9LMPojgkxv9YrUZjQ4Mnc';

export async function authenticateUser(authorization,{fetchImpl=fetch,env=process.env}={}) {
  if(!/^Bearer \S+$/.test(authorization || ''))throw new ServiceError(401,'Sign in before generating learning content.');
  const headers={Authorization:authorization,apikey:env.SUPABASE_ANON_KEY || PUBLIC_ANON_KEY};
  const response=await fetchImpl(`${SUPABASE_URL}/auth/v1/user`,{headers,signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new ServiceError(response.status>=500?503:401,response.status>=500?'Sign-in verification is temporarily unavailable. Please retry.':'Your session has expired. Sign in again.');
  const user=await response.json();
  if(!user?.id)throw new ServiceError(401,'Sign in before generating learning content.');
  return {user,headers};
}
