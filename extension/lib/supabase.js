// lib/supabase.js
// Supabase client for Chrome Extension (Manifest V3)
// Uses chrome.storage.local as the auth storage adapter
// because service workers do NOT have access to localStorage or window.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://kfdmduogwpgolhybqeez.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZG1kdW9nd3Bnb2xoeWJxZWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0Nzg4OTQsImV4cCI6MjEwNTA1NDg5NH0.lnT7Fiii9mABkyze2OnLIZ9LMPojgkxv9YrUZjQ4Mnc';

// Custom storage adapter that uses chrome.storage.local
// Required because: service workers have no localStorage, popup context unloads frequently
const chromeStorageAdapter = {
  getItem: (key) =>
    chrome.storage.local.get(key).then((result) => result[key] ?? null),
  setItem: (key, value) =>
    chrome.storage.local.set({ [key]: value }),
  removeItem: (key) =>
    chrome.storage.local.remove(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: chromeStorageAdapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // Disable URL-based session detection (not applicable in extensions)
  },
});

export { SUPABASE_URL, SUPABASE_ANON_KEY };
