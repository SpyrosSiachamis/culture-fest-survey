"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import en from "@/locales/en.json";
import el from "@/locales/el.json";

export const LOCALES = ["en", "el"] as const;
export type Locale = (typeof LOCALES)[number];

/** en.json is the source of truth; el.json must mirror its shape. */
type Dictionary = typeof en;

const DICTIONARIES: Record<Locale, Dictionary> = { en, el: el as Dictionary };

const STORAGE_KEY = "cf-locale";

/* ------------------------------------------------------------------ *
 * Locale store
 *
 * Kept outside React and read through useSyncExternalStore so the server
 * snapshot ("en") and the client's stored/browser preference reconcile
 * without a hydration mismatch — and without a setState-in-effect cascade.
 * ------------------------------------------------------------------ */

let current: Locale | null = null;
const listeners = new Set<() => void>();

function resolveLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "el") return stored;
  } catch {
    // Private mode / storage disabled — fall through to the browser language.
  }
  return navigator.language?.toLowerCase().startsWith("el") ? "el" : "en";
}

function getSnapshot(): Locale {
  if (current === null) current = resolveLocale();
  return current;
}

function getServerSnapshot(): Locale {
  return "en";
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function writeLocale(next: Locale): void {
  current = next;
  try {
    // Language choice only — never the JWT.
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Preference just won't persist; the session still switches.
  }
  listeners.forEach((fn) => fn());
}

/* ------------------------------------------------------------------ */

type I18nState = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Dotted lookup with {name} interpolation, e.g. t("survey.progress", { pct: 12 }). */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Same lookup for array values (ticker word lists). */
  tList: (key: string) => string[];
};

const I18nContext = createContext<I18nState | null>(null);

function lookup(dict: Dictionary, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[part]
          : undefined,
      dict,
    );
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setLocale = useCallback((l: Locale) => writeLocale(l), []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nState>(() => {
    const dict = DICTIONARIES[locale];
    return {
      locale,
      setLocale,
      t: (key, vars) => {
        // Fall back to English for any key missing from a translation.
        const raw = lookup(dict, key) ?? lookup(DICTIONARIES.en, key);
        if (typeof raw !== "string") return key;
        if (!vars) return raw;
        return raw.replace(/\{(\w+)\}/g, (m, name) =>
          name in vars ? String(vars[name]) : m,
        );
      },
      tList: (key) => {
        const raw = lookup(dict, key) ?? lookup(DICTIONARIES.en, key);
        return Array.isArray(raw) ? (raw as string[]) : [];
      },
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
