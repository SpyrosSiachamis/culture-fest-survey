"use client";

import { useState } from "react";

import { useLang } from "@/components/LanguageProvider";
import { FestivalShell, InlineLink } from "@/components/ui";
import { VerifyEmailForm } from "@/components/VerifyEmailForm";

/**
 * Standalone entry point for anyone who closed the tab after signing up.
 *
 * The address is typed in rather than read from the URL: it never needs to appear in browser
 * history, and the server refuses to say whether any given address has an account anyway.
 */
export default function VerifyPage() {
  const { t } = useLang();
  const [verified, setVerified] = useState(false);

  return (
    <FestivalShell
      eyebrow={verified ? t.eyebrows.done : t.eyebrows.verify}
      title={verified ? t.verify.verifiedHeading : t.verify.heading}
      description={verified ? undefined : t.verify.intro}
      footer={
        verified ? undefined : (
          <p className="text-center text-sm text-fest-cream/70">
            {t.verify.needAccount}{" "}
            <InlineLink href="/signup">{t.verify.needAccountLink}</InlineLink>
          </p>
        )
      }
    >
      <VerifyEmailForm emailEditable onVerified={() => setVerified(true)} />
    </FestivalShell>
  );
}
