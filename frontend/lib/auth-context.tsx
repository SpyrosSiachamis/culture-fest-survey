"use client";

import { createContext, useContext, useMemo, useState } from "react";

type AuthState = {
  token: string | null;
  setToken: (token: string | null) => void;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * Token lives in memory only — never localStorage or sessionStorage, per the
 * project's security note. Trade-off: a hard refresh signs the respondent out.
 * The backend token expires after 15 minutes, which comfortably covers one
 * sitting of the survey.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const value = useMemo(() => ({ token, setToken }), [token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
