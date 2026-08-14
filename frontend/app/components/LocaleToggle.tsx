"use client";

import { LOCALES, useI18n } from "@/lib/i18n";

/** EN / ΕΛ switch. 44px tall targets, sits above the fold on every screen. */
export function LocaleToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      // block-level (not inline-flex) so it never shares a line with the
      // inline-block wordmark link that follows it.
      className={`notch-sm flex w-fit border border-current/25 ${className}`}
      role="group"
      aria-label={t("lang.label")}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`ticker min-h-11 px-4 text-[11px] transition-colors ${
            locale === l ? "bg-gold text-ink" : "opacity-70 hover:opacity-100"
          }`}
        >
          {t(`lang.${l}`)}
        </button>
      ))}
    </div>
  );
}
