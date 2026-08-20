"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLang } from "@/components/LanguageProvider";

/** Credited in both locales; the name itself is a proper noun and is not translated. */
const DEVELOPER = "Spyridon Siachamis";

const DEVELOPER_URL = "https://www.linkedin.com/in/spyridon-siachamis-578793290/";

/**
 * The one footer, mounted once in the root layout so every public screen carries it.
 *
 * It sits *after* the page in the body's flex column rather than inside any of the page shells:
 * those shells are all `min-h-dvh`, and several of them (the split account screens especially)
 * position their panels absolutely, so a footer placed inside would either be clipped by a
 * clip-path or land on top of the artwork. Below the fold, in normal flow, is where a footer
 * belongs anyway.
 *
 * `usePathname` needs a client component, which this already is for the translations. Every route
 * in this app is statically prerendered with no dynamic params, so the pathname resolves at build
 * time and no Suspense boundary is required around it.
 */
export function SiteFooter() {
  const { t } = useLang();
  const pathname = usePathname();

  // The dashboard has its own grey chrome, its own nav, and a staff-only audience. A festival-styled
  // public footer under it would be neither useful there nor visually part of that screen.
  if (pathname.startsWith("/admin")) return null;

  return (
    // bg-ink, not transparent: the survey and profile shells paint a gradient that stops at their
    // own height, so without this the strip below them would fall back to the page background.
    <footer aria-label={t.footer.label} className="relative z-10 bg-ink">
      {/* Same gradient hairline the notched cards use for their edge, run flat across the seam. */}
      <div className="h-px w-full bg-linear-to-r from-gold/70 via-magenta/50 to-violet/60" />

      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-5 py-7 sm:flex-row sm:justify-between">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <p className="ticker text-[10px] text-bone/45">{t.footer.team}</p>
          <p className="text-[11px] text-bone/45">
            <Credit template={t.footer.developedBy} />
          </p>
        </div>

        <Link
          href="/privacy"
          className="notch-xs ticker flex min-h-11 items-center border border-bone/25 px-5 text-[11px] text-bone/75 transition-colors hover:border-gold/60 hover:text-gold"
        >
          {t.footer.privacy}
        </Link>
      </div>
    </footer>
  );
}

/**
 * "Developed by {name}", with the name linked to the developer's profile.
 *
 * `format()` from lib/i18n is no use here: it returns a flat string, and the name has to be an
 * element. Splitting the template on the placeholder keeps the surrounding words translatable and
 * lets each locale put the name where its grammar wants it.
 */
function Credit({ template }: { template: string }) {
  const [before, after = ""] = template.split("{name}");

  return (
    <>
      {before}
      <a
        href={DEVELOPER_URL}
        target="_blank"
        // noreferrer alongside noopener: the target is a personal profile, and there is no reason to
        // tell it which page the visitor came from.
        rel="noopener noreferrer"
        className="text-bone/70 underline underline-offset-2 transition-colors hover:text-gold"
      >
        {DEVELOPER}
      </a>
      {after}
    </>
  );
}
