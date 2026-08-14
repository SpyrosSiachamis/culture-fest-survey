"use client";

import { useState } from "react";

import { DEFAULT_RESEND_COOLDOWN_SECONDS, errorMessage, signup } from "@/lib/api";
import {
  PASSWORD_MIN_LENGTH,
  validateEmail,
  validatePassword,
  validatePhone,
} from "@/lib/validation";
import { Alert, Button, FestivalShell, Input, Stamp } from "@/components/ui";
import { VerifyEmailForm } from "@/components/VerifyEmailForm";

type FieldErrors = {
  email?: string;
  phone?: string;
  password?: string;
};

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set once signup has been accepted; switches this page over to the code step. The address is
  // held here rather than in the URL so it is not left behind in history or referrer headers.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const errors: FieldErrors = {
      email: validateEmail(email) ?? undefined,
      phone: validatePhone(phone) ?? undefined,
      password: validatePassword(password) ?? undefined,
    };
    setFieldErrors(errors);
    if (errors.email || errors.phone || errors.password) return;

    setSubmitting(true);
    setFormError(null);

    try {
      await signup({ email: email.trim(), phone: phone.trim(), password });
      setPendingEmail(email.trim());
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingEmail) {
    return (
      <FestivalShell
        title={verified ? "You're in" : "Check your email"}
        description={
          verified ? undefined : "Punch in the code we just sent and your account is live."
        }
        stamp={
          verified ? (
            <Stamp top="Status" value="OK" bottom="verified" tone="gold" />
          ) : (
            <Stamp top="Step" value="2" bottom="of 2" tone="gold" />
          )
        }
      >
        <VerifyEmailForm
          initialEmail={pendingEmail}
          initialCooldownSeconds={DEFAULT_RESEND_COOLDOWN_SECONDS}
          onVerified={() => setVerified(true)}
        />
      </FestivalShell>
    );
  }

  return (
    <FestivalShell
      title="Join the lineup"
      description="Create an account, confirm your email, then tell us how this festival should go down."
      stamp={<Stamp top="Step" value="1" bottom="of 2" />}
      footer={
        <p className="text-center text-sm text-white/70">
          Already signed up?{" "}
          <a href="/verify" className="font-semibold text-fest-gold underline underline-offset-4">
            Enter your code
          </a>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {formError && <Alert tone="error">{formError}</Alert>}

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

        <Input
          label="Phone number"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+30 691 234 5678"
          value={phone}
          error={fieldErrors.phone}
          disabled={submitting}
          onChange={(event) => setPhone(event.target.value)}
        />

        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          error={fieldErrors.password}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          disabled={submitting}
          onChange={(event) => setPassword(event.target.value)}
        />

        <Button type="submit" loading={submitting}>
          {submitting ? "Creating" : "Create account"}
        </Button>

        <p className="text-sm leading-relaxed text-white/70">
          Your email and phone are only ever stored as one-way hashes — they cannot be read back.
          They exist purely so each person answers once. Your survey answers are never linked to
          them.
        </p>
      </form>
    </FestivalShell>
  );
}
