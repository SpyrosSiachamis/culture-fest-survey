"use client";

import Link from "next/link";
import { useState } from "react";

import {
  DEFAULT_RESEND_COOLDOWN_SECONDS,
  errorMessage,
  isApiError,
  resendVerificationCode,
  verifyEmail,
  type VerificationStatus,
} from "@/lib/api";
import { CODE_LENGTH, makeValidators } from "@/lib/validation";
import { useCooldown } from "@/hooks/useCooldown";
import { useLang } from "@/components/LanguageProvider";
import { format } from "@/lib/i18n";
import { Field, Notice } from "./Field";
import { PrimaryButton, GhostButton } from "./PrimaryButton";

type Props = {
  /** Carried over from signup so the user does not have to retype it. */
  initialEmail?: string;
  /** Whether the address can be edited here (true when the page is reached directly). */
  emailEditable?: boolean;
  /** Seconds remaining before a resend is allowed, when arriving straight from signup. */
  initialCooldownSeconds?: number;
  /** Fired once the address is confirmed, so the surrounding screen can retitle itself. */
  onVerified?: () => void;
};

/** How each reportable state is rendered. Anything unlisted is treated as an error. */
const STATUS_TONE: Record<string, "error" | "success" | "info" | "warning"> = {
  verified: "success",
  already_verified: "info",
  resent: "info",
  expired: "warning",
  too_many_attempts: "warning",
};

/** Server statuses, plus the local-only "resent" notice. */
type ResultStatus = VerificationStatus | "error" | "resent";

/**
 * Six-digit code entry with resend.
 *
 * Every rule that matters — code correctness, expiry, single use, attempt ceiling and the resend
 * cooldown — is enforced server-side. Nothing here is a security control; the countdown and the
 * disabled states exist so the screen tells the truth about what the server will accept.
 */
export function VerifyCodeForm({
  initialEmail = "",
  emailEditable = false,
  initialCooldownSeconds = 0,
  onVerified,
}: Props) {
  const { t } = useLang();
  const v = makeValidators(t);

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; code?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [result, setResult] = useState<{ status: ResultStatus; message: string } | null>(null);

  const cooldown = useCooldown();
  const [seeded, setSeeded] = useState(false);
  if (!seeded && initialCooldownSeconds > 0) {
    setSeeded(true);
    cooldown.start(initialCooldownSeconds);
  }

  const verified = result?.status === "verified";
  // Once the code is spent there is nothing left to submit — only a fresh code can help.
  const needsNewCode = result?.status === "expired" || result?.status === "too_many_attempts";

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || verified) return;

    const errors = {
      email: v.email(email) ?? undefined,
      code: v.code(code) ?? undefined,
    };
    setFieldErrors(errors);
    if (errors.email || errors.code) return;

    setSubmitting(true);
    setResult(null);

    try {
      const response = await verifyEmail(email.trim(), code);
      setResult({ status: "verified", message: response.message });
      onVerified?.();
    } catch (error) {
      setResult({
        status: isApiError(error) ? error.status : "error",
        message: errorMessage(error),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resending || cooldown.isCoolingDown || verified) return;

    const emailError = v.email(email);
    if (emailError) {
      setFieldErrors((current) => ({ ...current, email: emailError }));
      return;
    }

    setResending(true);
    setResult(null);

    try {
      const response = await resendVerificationCode(email.trim());
      cooldown.start(response.cooldown_seconds || DEFAULT_RESEND_COOLDOWN_SECONDS);
      setCode("");
      // The server always answers the same way here, so this is an informational notice rather
      // than a confirmation that an email was actually sent.
      setResult({ status: "resent", message: response.message });
    } catch (error) {
      // A 429 here is the endpoint's own rate limit; still start the countdown so the button
      // cannot be hammered.
      cooldown.start(DEFAULT_RESEND_COOLDOWN_SECONDS);
      setResult({
        status: isApiError(error) ? error.status : "error",
        message: errorMessage(error),
      });
    } finally {
      setResending(false);
    }
  }

  if (verified) {
    return (
      <div className="flex flex-col gap-5">
        <Notice tone="success">{result?.message}</Notice>
        <p className="text-sm leading-relaxed text-bone/70">{t.verify.verifiedBody}</p>
        <Link href="/" className="block">
          <PrimaryButton type="button">{t.common.signIn}</PrimaryButton>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleVerify} noValidate className="flex flex-col gap-6">
      {result && <Notice tone={STATUS_TONE[result.status] ?? "error"}>{result.message}</Notice>}

      {emailEditable ? (
        <Field
          id="email"
          label={t.verify.editEmail}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t.signup.emailPlaceholder}
          value={email}
          error={fieldErrors.email}
          disabled={submitting}
          onChange={(event) => setEmail(event.target.value)}
        />
      ) : (
        <p className="text-sm leading-relaxed text-bone/70">
          {t.verify.sentTo} <span className="font-semibold text-gold">{email}</span>
        </p>
      )}

      <Field
        id="code"
        label={t.verify.codeLabel}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        placeholder="000000"
        value={code}
        error={fieldErrors.code}
        disabled={submitting}
        className="display h-16 text-center text-4xl tracking-[0.35em]"
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
      />

      <div className="flex flex-col gap-3">
        <PrimaryButton type="submit" disabled={submitting || needsNewCode}>
          {submitting ? t.verify.verifying : t.verify.verify}
        </PrimaryButton>

        <GhostButton type="button" disabled={resending || cooldown.isCoolingDown} onClick={handleResend}>
          {cooldown.isCoolingDown
            ? format(t.verify.resendIn, { seconds: cooldown.secondsLeft })
            : t.verify.resend}
        </GhostButton>

        <p className="text-center text-xs leading-relaxed text-bone/45">{t.verify.footnote}</p>

        {/* The account is created by signup, before any code is entered, and nothing else on this
            screen says so. Someone who closes the tab here has an account they cannot tell exists
            — this is the way back to it: signing in normally answers "verify your email first"
            and links straight to this form. */}
        <p className="text-center text-xs leading-relaxed text-bone/45">
          {t.verify.strandedHint}{" "}
          <Link href="/" className="font-semibold text-gold underline">
            {t.verify.strandedLink}
          </Link>
        </p>
      </div>
    </form>
  );
}
