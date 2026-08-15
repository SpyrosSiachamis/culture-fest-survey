/**
 * Number and date rendering for the dashboard.
 *
 * All of it runs after mount — every page fetches its data client-side — so there is no
 * server/client mismatch to worry about from locale-dependent output.
 *
 * Timestamps arrive from the API as naive **Europe/Athens** wall-clock strings (the app stores its
 * one timezone; see backend src/clock.py). They carry no offset, so they are rendered *verbatim* —
 * the digits shown are the digits stored — rather than converted into the reader's own timezone.
 * That is deliberate: this is a festival in Crete read by staff at the door, and "when did this
 * account redeem" has to say the Athens wall-clock time whatever timezone the staff laptop happens
 * to be set to.
 *
 * The mechanism: a naive string is parsed as if it were UTC (append `Z`), which preserves its
 * components on the resulting Date, and then every formatter renders in `UTC`, which reads those
 * same components straight back out. The Date is never a claim about a real instant — it is a
 * carrier for the wall-clock digits.
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

/**
 * A naive stored timestamp, as a Date whose UTC fields equal the stored wall-clock components.
 *
 * Always pair it with a formatter that renders in UTC (the ones below do), so the components come
 * back out unchanged. Reading it in any other timezone would shift the digits and misreport the
 * stored time.
 */
export function parseStamp(value: string): Date {
  return new Date(value.endsWith("Z") ? value : `${value}Z`);
}

/** Axis ticks: the hour within a day-long window, the weekday and date across longer ones. */
export function tickFormatter(window: string, lang: Lang): (at: Date) => string {
  const tag = localeTag(lang);

  if (window === "24h") {
    return (at) => at.toLocaleTimeString(tag, { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
  }

  return (at) => at.toLocaleDateString(tag, { timeZone: "UTC", weekday: "short", day: "numeric" });
}

export function dateTimeFormatter(lang: Lang): (at: Date) => string {
  const tag = localeTag(lang);
  return (at) =>
    at.toLocaleString(tag, {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
}

export function formatDate(value: string, lang: Lang): string {
  return parseStamp(value).toLocaleDateString(localeTag(lang), {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** A full date-and-time from a stored string, for the account lookup and anywhere both are wanted. */
export function formatDateTime(value: string, lang: Lang): string {
  return parseStamp(value).toLocaleString(localeTag(lang), {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
