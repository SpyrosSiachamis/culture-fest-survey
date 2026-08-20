"use client";

import Link from "next/link";
import { useEffect } from "react";

import { useLang } from "@/components/LanguageProvider";
import { POLICIES, type PolicyBlock } from "@/lib/privacy";
import { GlassCard } from "./GlassCard";
import { LocaleToggle } from "./LocaleToggle";
import { PrimaryButton } from "./PrimaryButton";

/**
 * The privacy policy, rendered from the structured document in `lib/privacy.ts`.
 *
 * Wider than the other screens (max-w-2xl against max-w-lg) because this is the one page people
 * read rather than scan — a legal document set to phone-form measure would be a wall.
 */
export function PrivacyScreen() {
  const { t, lang } = useLang();
  const policy = POLICIES[lang];

  // The tab should say what the page says, in the language the page is in. The route's static
  // metadata can only carry one language, so the client corrects it once the stored locale is read.
  useEffect(() => {
    document.title = t.privacy.title;
  }, [t]);

  return (
    <main className="fest-gradient fest-grain relative min-h-dvh">
      <div className="pointer-events-none absolute inset-0 bg-ink/45" />

      <div className="relative z-10 mx-auto w-full max-w-2xl px-5 pt-6 pb-14">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="wordmark text-[clamp(1.5rem,7vw,2rem)] text-white">
            {t.brand.name}
          </Link>
          <LocaleToggle className="border-white/30 text-white" />
        </div>

        <GlassCard className="mt-6">
          <p className="ticker text-[10px] text-gold">{t.privacy.eyebrow}</p>
          <h1 className="display mt-3 text-[clamp(2rem,9vw,2.75rem)] text-bone">
            {t.privacy.heading}
          </h1>

          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
            <Meta label={t.privacy.updatedLabel} value={policy.updated} />
            <Meta label={t.privacy.statusLabel} value={policy.status} />
          </dl>

          <p className="mt-6 text-sm leading-relaxed text-bone/70">{policy.intro}</p>

          {/* Stated in both locales, not just Greek: a reader of either one should know which text
              governs if the two ever drift. */}
          <p className="mt-4 border-l-2 border-gold/50 pl-4 text-xs leading-relaxed text-bone/50">
            {t.privacy.translationNote}
          </p>

          {policy.sections.map((section) => (
            <section key={section.id} id={section.id} className="mt-10 scroll-mt-6">
              <h2 className="display text-xl leading-tight text-bone">{section.heading}</h2>
              {section.blocks.map((block, position) => (
                <Block key={position} block={block} />
              ))}
            </section>
          ))}
        </GlassCard>

        <Link href="/" className="mt-8 block">
          <PrimaryButton type="button">{t.privacy.home}</PrimaryButton>
        </Link>
      </div>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="ticker text-[10px] text-bone/45">{label}</dt>
      <dd className="mt-1 text-sm text-bone/85">{value}</dd>
    </div>
  );
}

/**
 * One block of the document. The switch is exhaustive over the union in `lib/privacy.ts`, so a new
 * block kind added there is a type error here until it is given a rendering.
 */
function Block({ block }: { block: PolicyBlock }) {
  switch (block.kind) {
    case "p":
      return <p className="mt-4 text-sm leading-relaxed text-bone/70">{block.text}</p>;

    case "h3":
      return (
        <h3 className="ticker mt-6 text-[11px] text-gold">{block.text}</h3>
      );

    case "list":
      return (
        <ul className="mt-3 flex flex-col gap-2">
          {block.items.map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-relaxed text-bone/70">
              {/* Decorative marker, so it is hidden from the accessibility tree — the <ul> already
                  announces the list. */}
              <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-gold/70" />
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ul>
      );

    case "contact":
      return (
        <dl className="mt-4 flex flex-col gap-3">
          {block.rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
              <dt className="ticker shrink-0 text-[10px] text-bone/45 sm:w-44 sm:pt-1">
                {row.label}
              </dt>
              {/* break-all rather than truncate: an address that does not fit should wrap, not be
                  silently cut off — this is the one thing on the page a reader has to copy. */}
              <dd className="min-w-0 text-sm break-all text-bone/85">
                {row.href ? (
                  <a href={row.href} className="text-gold underline underline-offset-2">
                    {row.value}
                  </a>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      );
  }
}
