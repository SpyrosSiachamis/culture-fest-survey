"use client";

import Link from "next/link";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { useAuth } from "@/components/AuthProvider";
import { useLang } from "@/components/LanguageProvider";
import { format, type Dictionary } from "@/lib/i18n";
import type { Profile } from "@/lib/api";
import { DetailRow, StatusPill } from "../components/DetailRow";
import { Notice } from "../components/Field";
import { GlassCard } from "../components/GlassCard";
import { LocaleToggle } from "../components/LocaleToggle";
import { PrimaryButton, GhostButton } from "../components/PrimaryButton";
import { StampBadge } from "../components/StampBadge";

/** Same full-bleed gradient the survey runs on, so the pass feels like part of the same night. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="fest-gradient fest-grain relative min-h-dvh">
      <div className="pointer-events-none absolute inset-0 bg-ink/45" />
      <div className="relative z-10">{children}</div>
    </main>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-6 pb-10">
      {children}
    </div>
  );
}

/**
 * The account's own page: who this account is, whether its survey is in, and the QR code it shows
 * at the door.
 *
 * Everything rendered here comes from `/accounts/me`, which resolves the account from the session
 * cookie. No account id is sent up and none could be — there is nothing in this page's requests
 * for anyone to swap, so "view someone else's profile by changing an id" is not a shape this API
 * has. The flags below are read-only here too: only submitting a survey sets `allowed_to_redeem`,
 * and only the door scan sets `has_redeemed`.
 */
export default function ProfilePage() {
  const { t, lang } = useLang();
  const { profile, status, initialising, refresh, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [retrying, setRetrying] = useState(false);

  if (initialising) {
    return (
      <Shell>
        <Page>
          <Header />
          <GlassCard className="mt-6">
            <p className="ticker text-[10px] text-gold">{t.profile.eyebrow}</p>
            <div className="mt-5 flex flex-col gap-3" aria-label={t.common.loading}>
              <div className="h-8 w-2/3 animate-pulse bg-bone/12" />
              <div className="h-4 w-full animate-pulse bg-bone/8" />
              <div className="h-4 w-1/2 animate-pulse bg-bone/8" />
            </div>
          </GlassCard>
        </Page>
      </Shell>
    );
  }

  // Signed out — including a session that expired while the page was open.
  if (status === "anonymous") {
    return (
      <Shell>
        <Page>
          <Header />
          <div className="flex flex-1 items-center">
            <GlassCard className="w-full">
              <p className="ticker text-[10px] text-gold">{t.eyebrows.login}</p>
              <h2 className="display mt-3 text-4xl text-bone">{t.gate.heading}</h2>
              <p className="mt-3 text-sm text-bone/70">{t.profile.gateBody}</p>
              <div className="mt-8 flex flex-col gap-3">
                <Link href="/">
                  <PrimaryButton type="button">{t.common.signIn}</PrimaryButton>
                </Link>
                <Link href="/signup" className="text-center">
                  <GhostButton type="button" className="w-full">
                    {t.gate.createAccount}
                  </GhostButton>
                </Link>
              </div>
            </GlassCard>
          </div>
        </Page>
      </Shell>
    );
  }

  // Authenticated, but the profile call itself failed (backend down mid-session).
  if (!profile) {
    return (
      <Shell>
        <Page>
          <Header />
          <div className="flex flex-1 items-center">
            <GlassCard className="w-full">
              <Notice tone="error">{t.profile.loadError}</Notice>
              <div className="mt-6">
                <PrimaryButton
                  type="button"
                  disabled={retrying}
                  onClick={async () => {
                    setRetrying(true);
                    try {
                      await refresh();
                    } finally {
                      setRetrying(false);
                    }
                  }}
                >
                  {t.profile.retry}
                </PrimaryButton>
              </div>
            </GlassCard>
          </div>
        </Page>
      </Shell>
    );
  }

  return (
    <Shell>
      <Page>
        <Header />

        <GlassCard className="mt-6">
          <p className="ticker text-[10px] text-gold">{t.profile.eyebrow}</p>
          <h2 className="display mt-3 text-[clamp(2rem,9vw,2.75rem)] text-bone">
            {t.profile.heading}
          </h2>
          <p className="mt-3 text-sm text-bone/60">{t.profile.intro}</p>

          <div className="mt-6">
            <DetailRow label={t.profile.reference} value={profile.reference} />
            <DetailRow label={t.profile.memberSince} value={formatDate(profile.created_at, lang)} />
            <DetailRow label={t.profile.emailLabel} value={t.profile.emailValue}>
              <StatusPill tone={profile.email_verified ? "good" : "pending"}>
                {profile.email_verified ? t.profile.emailVerified : t.profile.emailUnverified}
              </StatusPill>
            </DetailRow>
            <DetailRow label={t.profile.surveyLabel}>
              <StatusPill tone={profile.has_voted ? "good" : "pending"}>
                {profile.has_voted ? t.profile.surveyDone : t.profile.surveyPending}
              </StatusPill>
            </DetailRow>
          </div>
        </GlassCard>

        <PassCard profile={profile} t={t} lang={lang} />

        <div className="mt-8 flex justify-center">
          <GhostButton
            type="button"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              try {
                await signOut();
              } finally {
                setSigningOut(false);
              }
            }}
          >
            {signingOut ? t.common.signingOut : t.common.signOut}
          </GhostButton>
        </div>
      </Page>
    </Shell>
  );
}

function Header() {
  const { t } = useLang();
  return (
    <div className="flex items-center justify-between gap-4">
      <Link href="/" className="wordmark text-[clamp(1.5rem,7vw,2rem)] text-white">
        {t.brand.name}
      </Link>
      <LocaleToggle className="border-white/30 text-white" />
    </div>
  );
}

/**
 * The door pass, in one of its three states.
 *
 * Which one is shown is decided by the server — the profile arrives with `redemption.status`
 * already resolved, and a QR credential is only ever sent for the one state that may present one.
 * An ineligible or already-claimed account is not sent a code that this page then has to remember
 * to hide.
 */
function PassCard({
  profile,
  t,
  lang,
}: {
  profile: Profile;
  t: Dictionary;
  lang: string;
}) {
  const { redemption } = profile;

  if (redemption.status === "not_eligible") {
    return (
      <GlassCard className="mt-5">
        <p className="ticker text-[10px] text-gold">{t.profile.passEyebrow}</p>
        <div className="mt-4 flex items-start gap-4">
          <StampBadge
            top={t.profile.notEligibleBadgeTop}
            main={t.profile.notEligibleBadgeMid}
            bottom={t.profile.notEligibleBadgeBottom}
            tone="light"
            className="opacity-60"
          />
          <div className="min-w-0">
            <h3 className="display text-2xl text-bone">{t.profile.notEligibleHeading}</h3>
            <p className="mt-2 text-sm text-bone/60">{t.profile.notEligibleBody}</p>
          </div>
        </div>
        <Link href="/survey" className="mt-6 block">
          <PrimaryButton type="button">{t.profile.takeSurvey}</PrimaryButton>
        </Link>
      </GlassCard>
    );
  }

  if (redemption.status === "redeemed") {
    return (
      <GlassCard className="mt-5">
        <p className="ticker text-[10px] text-gold">{t.profile.passEyebrow}</p>
        <div className="mt-4 flex items-start gap-4">
          <StampBadge
            top={t.profile.redeemedBadgeTop}
            main={t.profile.redeemedBadgeMid}
            bottom={t.profile.redeemedBadgeBottom}
            tone="gold"
          />
          <div className="min-w-0">
            <h3 className="display text-2xl text-bone">{t.profile.redeemedHeading}</h3>
            <p className="mt-2 text-sm text-bone/60">{t.profile.redeemedBody}</p>
          </div>
        </div>
        <div className="mt-5">
          <Notice tone="success">
            {redemption.redeemed_at
              ? format(t.profile.redeemedAt, { when: formatDateTime(redemption.redeemed_at, lang) })
              : t.profile.redeemedHeading}
          </Notice>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="mt-5">
      <p className="ticker text-[10px] text-gold">{t.profile.passEyebrow}</p>
      <div className="mt-4 flex items-start gap-4">
        <StampBadge
          top={t.profile.readyBadgeTop}
          main={t.profile.readyBadgeMid}
          bottom={t.profile.readyBadgeBottom}
          tone="gold"
        />
        <div className="min-w-0">
          <h3 className="display text-2xl text-bone">{t.profile.readyHeading}</h3>
          <p className="mt-2 text-sm text-bone/60">{t.profile.readyBody}</p>
        </div>
      </div>

      {/* Bone stock behind the code: a scanner needs the light quiet zone, and it reads as the one
          printed thing on an otherwise dark page. */}
      <div className="notch mt-6 bg-linear-to-br from-gold/70 via-magenta/50 to-violet/60 p-px">
        <div className="notch bg-bone p-5 sm:p-7">
          <QRCodeSVG
            value={redemption.token ?? ""}
            level="M"
            marginSize={2}
            bgColor="#f5efe6"
            fgColor="#14031f"
            title={t.profile.readyHeading}
            // Deliberately large: the credential is a signed JWT, so the code is dense and needs
            // the pixels to stay readable off a phone screen at a dark door.
            className="mx-auto h-auto w-full max-w-80"
          />
        </div>
      </div>

      <p className="mt-4 text-xs text-bone/45">{t.profile.privacy}</p>
    </GlassCard>
  );
}

/** Dates are rendered client-side only (the profile is fetched after mount), so no SSR mismatch. */
function localeTag(lang: string) {
  return lang === "el" ? "el-GR" : "en-GB";
}

function formatDate(value: string, lang: string): string {
  return new Date(value).toLocaleDateString(localeTag(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string, lang: string): string {
  return new Date(value).toLocaleString(localeTag(lang), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
