"use client";

import Link from "next/link";
import { useState } from "react";

import { useLang } from "@/components/LanguageProvider";
import { SplitLayout } from "../components/SplitLayout";
import { VerifyCodeForm } from "../components/VerifyCodeForm";

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
    <SplitLayout>
      <p className="ticker text-[10px] text-gold">
        {verified ? t.eyebrows.done : t.eyebrows.verify}
      </p>
      <h2 className="display mt-3 text-4xl text-bone">
        {verified ? t.verify.verifiedHeading : t.verify.heading}
      </h2>
      {!verified && <p className="mt-3 text-sm text-bone/65">{t.verify.intro}</p>}

      <div className="mt-8">
        <VerifyCodeForm emailEditable onVerified={() => setVerified(true)} />
      </div>

      {!verified && (
        <p className="mt-6 text-sm text-bone/60">
          {t.verify.needAccount}{" "}
          <Link href="/signup" className="font-semibold text-gold underline">
            {t.verify.needAccountLink}
          </Link>
        </p>
      )}
    </SplitLayout>
  );
}
