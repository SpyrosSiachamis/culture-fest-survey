"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";

import { DICTIONARIES, type Dictionary, type Lang } from "@/lib/i18n";

const STORAGE_KEY = "culture-fest-lang";

/**
 * The stored language preference, exposed as an external store.
 *
 * `useSyncExternalStore` is the right tool here rather than `useState` + `useEffect`: it lets the
 * server render a known snapshot ("en") while the client reads the real value from localStorage,
 * with no hydration mismatch and no cascading re-render from a setState inside an effect.
 */
const languageStore = {
  listeners: new Set<() => void>(),

  subscribe(listener: () => void) {
    languageStore.listeners.add(listener);
    return () => {
      languageStore.listeners.delete(listener);
    };
  },

  getSnapshot(): Lang {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "el" ? "el" : "en";
  },

  // The server has no localStorage, so it always renders English.
  getServerSnapshot(): Lang {
    return "en";
  },

  set(lang: Lang) {
    // A language choice is a display preference, not a secret — persisting it is fine.
    window.localStorage.setItem(STORAGE_KEY, lang);
    languageStore.listeners.forEach((listener) => listener());
  },
};

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dictionary;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(
    languageStore.subscribe,
    languageStore.getSnapshot,
    languageStore.getServerSnapshot
  );

  // Keep the document language in step, so screen readers and the browser pick the right voice
  // and hyphenation rules. Syncing an external system is what effects are for.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => languageStore.set(next), []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: DICTIONARIES[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLang must be used inside LanguageProvider");
  return context;
}
