/**
 * Number and date rendering for the dashboard.
 *
 * All of it runs after mount — every page fetches its data client-side — so there is no
 * server/client mismatch to worry about from locale-dependent output.
 *
 * Timestamps arrive from the API as naive UTC, matching the columns they are read from. They are
 * parsed as UTC explicitly and shown in the reader's own timezone, which is the only rendering that
 * is not quietly wrong for whoever is looking at the screen.
 */

import type { Lang } from "@/lib/i18n";

export function localeTag(lang: Lang): string {
  return lang === "el" ? "el-GR" : "en-GB";
}

export function formatNumber(value: number, lang: Lang): string {
  return value.toLocaleString(localeTag(lang));
}

export function formatPercent(value: number, lang: Lang): string {
  return `${value.toLocaleString(localeTag(lang), { maximumFractionDigits: 1 })}%`;
}

/** The API's naive-UTC timestamps, as a real instant. */
export function parseUtc(value: string): Date {
  return new Date(value.endsWith("Z") ? value : `${value}Z`);
}

/** Axis ticks: the hour within a day-long window, the weekday and date across longer ones. */
export function tickFormatter(window: string, lang: Lang): (at: Date) => string {
  const tag = localeTag(lang);

  if (window === "24h") {
    return (at) => at.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
  }

  return (at) => at.toLocaleDateString(tag, { weekday: "short", day: "numeric" });
}

export function dateTimeFormatter(lang: Lang): (at: Date) => string {
  const tag = localeTag(lang);
  return (at) =>
    at.toLocaleString(tag, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
}

export function formatDate(value: string, lang: Lang): string {
  return parseUtc(value).toLocaleDateString(localeTag(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
