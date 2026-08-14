"use client";

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
import { Alert, Button, InlineLink, Input } from "@/components/ui";

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
const STATUS_TONE: Record<string, "error" | "success" | "info"> = {
  verified: "success",
  already_verified: "info",
  resent: "info",
};

/** Server statuses, plus the local-only "resent" notice. */
type ResultStatus = VerificationStatus | "error" | "resent";

export function VerifyEmailForm({
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
        <Alert tone="success">{result?.message}</Alert>
        <p className="text-base leading-relaxed text-fest-cream/70">{t.verify.verifiedBody}</p>
        <InlineLink href="/login">
          <Button type="button">{t.common.signIn}</Button>
        </InlineLink>
      </div>
    );
  }

  return (
    <form onSubmit={handleVerify} noValidate className="flex flex-col gap-6">
      {result && <Alert tone={STATUS_TONE[result.status] ?? "error"}>{result.message}</Alert>}

      {emailEditable ? (
        <Input
          label={t.verify.editEmail}
          name="email"
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
        <p className="text-base leading-relaxed text-fest-cream/70">
          {t.verify.sentTo} <span className="font-semibold text-fest-gold">{email}</span>
        </p>
      )}

      <Input
        label={t.verify.codeLabel}
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        placeholder="000000"
        value={code}
        error={fieldErrors.code}
        disabled={submitting}
        className="h-20 text-center font-mono text-4xl tracking-[0.3em]"
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
      />

      <div className="flex flex-col gap-3">
        <Button type="submit" loading={submitting} disabled={needsNewCode}>
          {submitting ? t.verify.verifying : t.verify.verify}
        </Button>

        <Button
          type="button"
          variant="secondary"
          loading={resending}
          disabled={cooldown.isCoolingDown}
          onClick={handleResend}
        >
          {cooldown.isCoolingDown ? t.verify.resendIn(cooldown.secondsLeft) : t.verify.resend}
        </Button>

        <p className="text-center text-sm leading-relaxed text-fest-cream/50">
          {t.verify.footnote}
        </p>
      </div>
    </form>
  );
}
