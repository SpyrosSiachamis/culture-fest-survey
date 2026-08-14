"use client";

import Link from "next/link";
import { StampBadge } from "./StampBadge";
import { LocaleToggle } from "./LocaleToggle";
import { Ticker } from "./Ticker";
import { useI18n } from "@/lib/i18n";

/**
 * The diagonal 50/50 split used by /signup and /login.
 *
 * < 1024px  stacked — gradient band on top, its bottom edge cut on a diagonal,
 *           form flows underneath (the seam still reads at 375px).
 * >= 1024px two absolutely-positioned panels sharing one diagonal seam,
 *           roughly 50/50 by area.
 *
 * Clip-path geometry lives in globals.css as .split-brand / .split-form.
 */
export function SplitLayout({ children }: { children: React.ReactNode }) {
  const { t, tList } = useI18n();

  return (
    <div className="relative min-h-dvh">
      {/* Brand panel */}
      <div className="fest-gradient fest-grain split-brand relative overflow-hidden px-6 pt-6 pb-24 lg:absolute lg:inset-0 lg:flex lg:items-center lg:px-0 lg:pt-0 lg:pb-0">
        {/* Scrim keeps type legible where the gradient runs into gold. */}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-ink/45 via-transparent to-ink/30" />

        <div className="relative z-10 lg:w-1/2 lg:pl-[8%] lg:pr-[6%]">
          <LocaleToggle className="mb-7 border-white/30 text-white" />

          <Link href="/" className="inline-block">
            <p className="ticker text-[10px] text-white/80">{t("brand.place")}</p>
            <h1 className="wordmark mt-3 text-[clamp(2.75rem,13vw,5.5rem)] text-white lg:text-[clamp(3.5rem,4.6vw,6rem)]">
              {t("brand.line1")}
              <br />
              {t("brand.line2")}
            </h1>
          </Link>

          <Ticker
            words={tList("brand.tickerWords")}
            className="mt-4 text-[11px] text-white/90"
          />

          <div className="mt-7 flex items-center gap-4">
            <StampBadge
              top={t("brand.anonTop")}
              main={t("brand.anonMain")}
              bottom={t("brand.anonBottom")}
              tone="light"
            />
            <p className="max-w-56 text-sm text-white/90">
              {t("brand.anonBody")}
            </p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="split-form relative z-10 -mt-10 bg-ink px-6 pt-4 pb-14 lg:absolute lg:inset-0 lg:mt-0 lg:flex lg:items-center lg:justify-end lg:px-0 lg:pt-0 lg:pb-0">
        <div className="mx-auto w-full max-w-md lg:mx-0 lg:w-[38%] lg:pr-[8%]">
          {children}
        </div>
      </div>
    </div>
  );
}
