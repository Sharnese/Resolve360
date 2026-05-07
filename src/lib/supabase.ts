import { createClient } from '@supabase/supabase-js';

// Resolve360 production Supabase project
const supabaseUrl = 'https://hjcyqlfzdjjokljzqfhf.supabase.co';
const supabaseKey = 'sb_publishable_dCoWwKUF9UujMBl73Ho-gw_FlN_WBJ-';

// Use a stable storage key so we can deterministically clear it on signOut.
export const SUPABASE_AUTH_STORAGE_KEY = 'resolve360-auth';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: SUPABASE_AUTH_STORAGE_KEY,
    flowType: 'pkce',
  },
});

/**
 * Aggressively clear every trace of Supabase auth from the browser.
 * Belt-and-suspenders cleanup so a stale token can never block a fresh login/logout.
 */
export const clearAuthStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    // Known key
    window.localStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
    window.sessionStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);

    // Any legacy / project-default supabase auth keys
    const wipe = (storage: Storage) => {
      const toRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (!k) continue;
        if (
          k.startsWith('sb-') ||
          k.startsWith('supabase.') ||
          k.includes('-auth-token') ||
          k === SUPABASE_AUTH_STORAGE_KEY
        ) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => storage.removeItem(k));
    };
    wipe(window.localStorage);
    wipe(window.sessionStorage);

    // Clear any auth cookies that might have been set
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim();
      if (name.startsWith('sb-') || name.includes('supabase')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
      }
    });
  } catch {
    /* noop */
  }
};

export { supabase };
