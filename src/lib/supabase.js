import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kfdmduogwpgolhybqeez.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZG1kdW9nd3Bnb2xoeWJxZWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0Nzg4OTQsImV4cCI6MjEwNTA1NDg5NH0.lnT7Fiii9mABkyze2OnLIZ9LMPojgkxv9YrUZjQ4Mnc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
