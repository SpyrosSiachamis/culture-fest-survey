"use client";

import { useState } from "react";

import { FestivalShell, Stamp } from "@/components/ui";
import { VerifyEmailForm } from "@/components/VerifyEmailForm";

/**
 * Standalone entry point for anyone who closed the tab after signing up.
 *
 * The address is typed in rather than read from the URL: it never needs to appear in browser
 * history, and the server refuses to say whether any given address has an account anyway.
 */
export default function VerifyPage() {
  const [verified, setVerified] = useState(false);

  return (
    <FestivalShell
      eyebrow={verified ? undefined : "Account"}
      title={verified ? "Email verified" : "Enter your code"}
      description={
        verified
          ? undefined
          : "Give us the email you signed up with and the 6-digit code we sent you."
      }
      stamp={
        verified ? (
          <Stamp top="Status" value="OK" bottom="verified" tone="gold" />
        ) : (
          <Stamp top="Expires" value="15" bottom="minutes" />
        )
      }
      footer={
        verified ? undefined : (
          <p className="text-center text-sm text-white/70">
            Need an account?{" "}
            <a href="/signup" className="font-semibold text-fest-gold underline underline-offset-4">
              Sign up here
            </a>
          </p>
        )
      }
    >
      <VerifyEmailForm emailEditable onVerified={() => setVerified(true)} />
    </FestivalShell>
  );
}
