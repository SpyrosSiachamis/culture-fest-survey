"use client";

import Link from "next/link";
import { useEffect } from "react";

import { useLang } from "@/components/LanguageProvider";
import { GlassCard } from "./GlassCard";
import { LocaleToggle } from "./LocaleToggle";
import { PrimaryButton } from "./PrimaryButton";

/**
 * The one 404 screen.
 *
 * Rendered from two places that must look identical: `app/not-found.tsx`, which Next serves for any
 * URL that matches no route, and the admin dashboard, which renders it when the API refuses. That
 * sameness is the point of it being a shared component rather than two similar screens — a mistyped
 * address and a refused dashboard should be the same dead end, so that being told "no" reveals
 * nothing about which of the two happened.
 *
 * Worth being straight about the limit: `/admin/dashboard` is a real route in the build and will
 * always respond to a request, so nothing on this side of the wire hides it from someone reading
 * the network tab. What actually protects the dashboard is that every `/admin` endpoint refuses
 * unauthorised callers itself. This screen keeps the two indistinguishable to a person looking at
 * the page, and no more than that.
 */
export function NotFoundScreen() {
  const { t } = useLang();

  // The tab is part of the page. Without this the dashboard's refusal would still be titled
  // "Culture Fest · Admin" from its layout while a genuine 404 read "Culture Fest Survey", which is
  // exactly the sort of tell the shared markup above exists to remove. It is also just better on a
  // real 404 — the tab should say what the page says.
  useEffect(() => {
    document.title = t.notFound.title;
  }, [t]);

  return (
    <main className="fest-gradient fest-grain relative min-h-dvh">
      <div className="pointer-events-none absolute inset-0 bg-ink/45" />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-6 pb-10">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="wordmark text-[clamp(1.5rem,7vw,2rem)] text-white">
            {t.brand.name}
          </Link>
          <LocaleToggle className="border-white/30 text-white" />
        </div>

        <div className="flex flex-1 items-center">
          <GlassCard className="w-full">
            <p className="ticker text-[10px] text-gold">{t.notFound.eyebrow}</p>
            <h1 className="display mt-3 text-[clamp(3rem,18vw,5rem)] text-bone">404</h1>
            <p className="mt-4 text-sm text-bone/80">{t.notFound.heading}</p>
            <p className="mt-2 text-sm text-bone/55">{t.notFound.body}</p>

            <Link href="/" className="mt-8 block">
              <PrimaryButton type="button">{t.notFound.home}</PrimaryButton>
            </Link>
          </GlassCard>
        </div>
      </div>
    </main>
  );
}
