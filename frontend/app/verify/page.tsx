"use client";

import { FormShell } from "@/components/ui";
import { VerifyEmailForm } from "@/components/VerifyEmailForm";

/**
 * Standalone entry point for anyone who closed the tab after signing up.
 *
 * The address is typed in rather than read from the URL: it never needs to appear in browser
 * history, and the server refuses to say whether any given address has an account anyway.
 */
export default function VerifyPage() {
  return (
    <FormShell
      title="Verify your email"
      description="Enter your email address and the 6-digit code we sent you."
    >
      <VerifyEmailForm emailEditable />
    </FormShell>
  );
}
