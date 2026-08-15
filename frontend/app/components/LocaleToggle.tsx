"use client";

import { useLang } from "@/components/LanguageProvider";
import { LANGUAGES } from "@/lib/i18n";

/** EN / ΕΛ switch. 44px tall targets, sits above the fold on every screen. */
export function LocaleToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();

  return (
    <div
      // block-level (not inline-flex) so it never shares a line with the
      // inline-block wordmark link that follows it.
      className={`notch-sm flex w-fit border border-current/25 ${className}`}
      role="group"
      aria-label="Language"
    >
      {LANGUAGES.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => setLang(option.code)}
          aria-pressed={lang === option.code}
          className={`ticker min-h-11 px-4 text-[11px] transition-colors cursor-pointer ${
            lang === option.code ? "bg-gold text-ink" : "opacity-70 hover:opacity-100"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
