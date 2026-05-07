import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase, clearAuthStorage } from '@/lib/supabase';

interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'client';
  must_change_password: boolean;
  company_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

interface AuthCtx {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({} as any);
export const useAuth = () => useContext(AuthContext);

// Hard cap so a hung network request can never trap the UI in a loading state.
const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  new Promise<T>((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch(() => {
      clearTimeout(t);
      resolve(fallback);
    });
  });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const loadProfile = async (uid: string) => {
    try {
      const res = await withTimeout(
        supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
        6000,
        { data: null, error: null } as any,
      );
      if (mounted.current) setProfile((res?.data as any) || null);
    } catch {
      if (mounted.current) setProfile(null);
    }
  };

  useEffect(() => {
    mounted.current = true;
    let initialized = false;

    // Bootstrap from storage
    (async () => {
      try {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          6000,
          { data: { session: null } } as any,
        );
        if (!mounted.current) return;
        const session = data?.session;
        if (session?.user) {
          setUser(session.user);
          await loadProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch {
        if (mounted.current) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted.current) {
          setLoading(false);
          initialized = true;
        }
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted.current) return;
      // Synchronously update auth state — never await inside the listener
      // (per Supabase guidance) to avoid deadlocks that cause indefinite buffering.
      if (session?.user) {
        setUser(session.user);
        // Fire-and-forget; loading is already false.
        loadProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      if (initialized) setLoading(false);
      if (event === 'SIGNED_OUT') {
        // Make absolutely sure nothing stale is left behind.
        clearAuthStorage();
      }
    });

    return () => {
      mounted.current = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    // Always start from a clean slate so a stale token can't conflict with the new login.
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    clearAuthStorage();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    if (data?.session?.user) {
      setUser(data.session.user);
      await loadProfile(data.session.user.id);
    }
    return {};
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    // Clean slate before creating a new account too.
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    clearAuthStorage();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName } },
    });
    if (error) return { error: error.message };

    // If email confirmation is enabled, there may not be an active session yet.
    // Try to sign in immediately to guarantee the user is authenticated before they submit a request.
    if (!data.session) {
      const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
      if (siErr) return { error: siErr.message };
    }

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      // Upsert profile row (insert if not present)
      await supabase.from('profiles').upsert({
        id: authUser.id,
        email: authUser.email,
        role: 'client',
        must_change_password: false,
        first_name: firstName,
        last_name: lastName,
      }, { onConflict: 'id' });
      await loadProfile(authUser.id);
      setUser(authUser);
    }
    return {};
  };

  const signOut = async () => {
    // Optimistically clear local state immediately so the UI never hangs,
    // even if the network call fails.
    setUser(null);
    setProfile(null);
    try {
      await withTimeout(supabase.auth.signOut(), 4000, { error: null } as any);
    } catch {
      /* ignore */
    }
    clearAuthStorage();
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
