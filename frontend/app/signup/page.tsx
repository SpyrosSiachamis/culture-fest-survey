"use client";

import { useState } from "react";

import { DEFAULT_RESEND_COOLDOWN_SECONDS, errorMessage, signup } from "@/lib/api";
import { PASSWORD_MIN_LENGTH, makeValidators } from "@/lib/validation";
import { useLang } from "@/components/LanguageProvider";
import { format } from "@/lib/i18n";
import { Alert, Button, FestivalShell, InlineLink, Input, Stamp } from "@/components/ui";
import { VerifyEmailForm } from "@/components/VerifyEmailForm";

type FieldErrors = {
  email?: string;
  phone?: string;
  password?: string;
};

/** Masthead block: place, wordmark, tagline and the anonymity stamp. */
function Hero() {
  const { t } = useLang();
  return (
    <div className="flex flex-col gap-4 pt-2">
      <p className="fest-micro text-[11px] text-fest-cream/70">{t.brand.place}</p>
      <h1 className="fest-display text-[3.25rem] leading-[0.9] text-fest-cream sm:text-6xl">
        {t.brand.name}
      </h1>
      <p className="fest-micro flex flex-wrap items-center gap-x-2 text-[11px] text-fest-cream/80">
        {t.brand.tagline.map((word, index) => (
          <span key={word} className="flex items-center gap-2">
            {index > 0 && <span className="text-fest-gold">*</span>}
            {word}
          </span>
        ))}
      </p>
      <div className="flex items-center gap-4 pt-1">
        <Stamp top={t.anon.badgeTop} value={t.anon.badgeMid} bottom={t.anon.badgeBottom} />
        <p className="flex-1 text-sm leading-relaxed text-fest-cream/75">{t.anon.blurb}</p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  const { t } = useLang();
  const v = makeValidators(t);

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
      email: v.email(email) ?? undefined,
      phone: v.phone(phone) ?? undefined,
      password: v.password(password) ?? undefined,
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
        eyebrow={verified ? t.eyebrows.done : t.eyebrows.verify}
        title={verified ? t.verify.verifiedHeading : t.verify.heading}
        description={verified ? undefined : t.verify.intro}
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
      hero={<Hero />}
      eyebrow={t.eyebrows.signup}
      title={t.signup.heading}
      description={t.signup.intro}
      footer={
        <p className="text-center text-sm text-fest-cream/70">
          {t.signup.haveAccount}{" "}
          <InlineLink href="/verify">{t.signup.haveAccountLink}</InlineLink>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        {formError && <Alert tone="error">{formError}</Alert>}

        <Input
          label={t.signup.email}
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

        <Input
          label={t.signup.phone}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={t.signup.phonePlaceholder}
          value={phone}
          error={fieldErrors.phone}
          disabled={submitting}
          onChange={(event) => setPhone(event.target.value)}
        />

        <Input
          label={t.signup.password}
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          error={fieldErrors.password}
          hint={format(t.signup.passwordHint, { min: PASSWORD_MIN_LENGTH })}
          disabled={submitting}
          onChange={(event) => setPassword(event.target.value)}
        />

        <div className="flex flex-col gap-4">
          <Button type="submit" loading={submitting}>
            {submitting ? t.signup.submitting : t.signup.submit}
          </Button>
          <p className="text-sm leading-relaxed text-fest-cream/50">{t.signup.privacy}</p>
        </div>
      </form>
    </FestivalShell>
  );
}
