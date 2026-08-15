"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { fetchProfile, logout as logoutRequest, type Profile } from "@/lib/api";

/**
 * Who is signed in, restored from the backend on every load.
 *
 * The session itself lives in an HttpOnly cookie that this code cannot read — which is the point.
 * On mount the app asks `/accounts/me` who the caller is; the browser attaches the cookie, the
 * backend validates it and answers with the profile, or 401s and the app treats the visitor as a
 * guest. So a refresh restores the session from a *server* check, never from remembered client
 * state, and every protected call is authenticated again on the server regardless of what this
 * provider believes.
 *
 * The previous in-memory token store is gone: it could not survive a reload by construction, which
 * is exactly why signing in appeared to be forgotten on refresh.
 */

type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  status: AuthStatus;
  profile: Profile | null;
  /** True while the very first "who am I" call is outstanding — no flash of signed-out UI. */
  initialising: boolean;
  /** Re-read the profile from the server. Call after anything that changes account state. */
  refresh: () => Promise<Profile | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [initialising, setInitialising] = useState(true);

  // Guards against a late response from an earlier refresh overwriting a newer one, and against
  // setting state after unmount.
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;

    let next: Profile | null = null;
    try {
      next = await fetchProfile();
    } catch {
      // A network failure is not proof of being signed out. Keep whatever is known and let the
      // page report the error; the next refresh settles it.
      if (id === requestId.current) setInitialising(false);
      return profile;
    }

    if (id !== requestId.current) return next;

    setProfile(next);
    setStatus(next ? "authenticated" : "anonymous");
    setInitialising(false);
    return next;
  }, [profile]);

  const signOut = useCallback(async () => {
    try {
      // Server-side first: the cookie has to actually be cleared, not just forgotten here.
      await logoutRequest();
    } finally {
      requestId.current++;
      setProfile(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    // Deliberately not depending on `refresh`: this runs once, on load, to answer "is there a
    // session?". Re-running it on every identity change of the callback would refetch endlessly.
    let cancelled = false;
    const id = ++requestId.current;

    fetchProfile()
      .then((next) => {
        if (cancelled || id !== requestId.current) return;
        setProfile(next);
        setStatus(next ? "authenticated" : "anonymous");
      })
      .catch(() => {
        // Unreachable backend: treat as signed out for rendering purposes. Nothing is unlocked by
        // this — the server still decides on every request.
        if (!cancelled && id === requestId.current) setStatus("anonymous");
      })
      .finally(() => {
        if (!cancelled) setInitialising(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ status, profile, initialising, refresh, signOut }),
    [status, profile, initialising, refresh, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
