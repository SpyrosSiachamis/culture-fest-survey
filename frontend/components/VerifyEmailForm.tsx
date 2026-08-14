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
import { CODE_LENGTH, validateCode, validateEmail } from "@/lib/validation";
import { useCooldown } from "@/hooks/useCooldown";
import { Alert, Button, Input } from "@/components/ui";

type Props = {
  /** Carried over from signup so the user does not have to retype it. */
  initialEmail?: string;
  /** Whether the address can be edited here (true when the page is reached directly). */
  emailEditable?: boolean;
  /** Seconds remaining before a resend is allowed, when arriving straight from signup. */
  initialCooldownSeconds?: number;
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
}: Props) {
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
      email: validateEmail(email) ?? undefined,
      code: validateCode(code) ?? undefined,
    };
    setFieldErrors(errors);
    if (errors.email || errors.code) return;

    setSubmitting(true);
    setResult(null);

    try {
      const response = await verifyEmail(email.trim(), code);
      setResult({ status: "verified", message: response.message });
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

    const emailError = validateEmail(email);
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
      <div className="flex flex-col gap-6">
        <Alert tone="success">{result?.message}</Alert>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Your email address is confirmed. You can now sign in and take the survey.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleVerify} noValidate className="flex flex-col gap-5">
      {result && (
        <Alert tone={STATUS_TONE[result.status] ?? "error"}>{result.message}</Alert>
      )}

      {emailEditable ? (
        <Input
          label="Email address"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          error={fieldErrors.email}
          disabled={submitting}
          onChange={(event) => setEmail(event.target.value)}
        />
      ) : (
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          We sent a {CODE_LENGTH}-digit code to{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{email}</span>.
        </p>
      )}

      <Input
        label={`${CODE_LENGTH}-digit code`}
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        placeholder="000000"
        value={code}
        error={fieldErrors.code}
        disabled={submitting}
        className="text-center font-mono text-2xl tracking-[0.4em]"
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
      />

      <Button type="submit" loading={submitting} disabled={needsNewCode}>
        {submitting ? "Verifying…" : "Verify email"}
      </Button>

      <div className="flex flex-col items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          loading={resending}
          disabled={cooldown.isCoolingDown}
          onClick={handleResend}
        >
          {cooldown.isCoolingDown
            ? `Resend code in ${cooldown.secondsLeft}s`
            : "Send a new code"}
        </Button>
        <p className="text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
          Codes expire after 15 minutes and can only be used once. Check your spam folder if the
          email has not arrived.
        </p>
      </div>
    </form>
  );
}
