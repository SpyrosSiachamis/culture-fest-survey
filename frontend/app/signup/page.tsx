"use client";

import Link from "next/link";
import { useState } from "react";

import { DEFAULT_RESEND_COOLDOWN_SECONDS, errorMessage, signup } from "@/lib/api";
import { PASSWORD_MIN_LENGTH, makeValidators } from "@/lib/validation";
import { useLang } from "@/components/LanguageProvider";
import { format } from "@/lib/i18n";
import { SplitLayout } from "../components/SplitLayout";
import { Field, Notice } from "../components/Field";
import { PrimaryButton } from "../components/PrimaryButton";
import { VerifyCodeForm } from "../components/VerifyCodeForm";

type FieldErrors = {
  email?: string;
  phone?: string;
  password?: string;
};

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
      <SplitLayout>
        <p className="ticker text-[10px] text-gold">
          {verified ? t.eyebrows.done : t.eyebrows.verify}
        </p>
        <h2 className="display mt-3 text-4xl text-bone">
          {verified ? t.verify.verifiedHeading : t.verify.heading}
        </h2>
        {!verified && <p className="mt-3 text-sm text-bone/65">{t.verify.intro}</p>}

        <div className="mt-8">
          <VerifyCodeForm
            initialEmail={pendingEmail}
            initialCooldownSeconds={DEFAULT_RESEND_COOLDOWN_SECONDS}
            onVerified={() => setVerified(true)}
          />
        </div>
      </SplitLayout>
    );
  }

  return (
    <SplitLayout>
      <p className="ticker text-[10px] text-gold">{t.eyebrows.signup}</p>
      <h2 className="display mt-3 text-4xl text-bone">{t.signup.heading}</h2>
      <p className="mt-3 text-sm text-bone/65">{t.signup.intro}</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-6">
        {formError && <Notice tone="error">{formError}</Notice>}

        <Field
          id="email"
          label={t.signup.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t.signup.emailPlaceholder}
          value={email}
          error={fieldErrors.email}
          disabled={submitting}
          onChange={(event) => setEmail(event.target.value)}
        />

        <Field
          id="phone"
          label={t.signup.phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={t.signup.phonePlaceholder}
          value={phone}
          error={fieldErrors.phone}
          disabled={submitting}
          onChange={(event) => setPhone(event.target.value)}
        />

        <Field
          id="password"
          label={t.signup.password}
          type="password"
          autoComplete="new-password"
          value={password}
          error={fieldErrors.password}
          hint={format(t.signup.passwordHint, { min: PASSWORD_MIN_LENGTH })}
          disabled={submitting}
          onChange={(event) => setPassword(event.target.value)}
        />

        <div className="flex flex-col gap-4">
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? t.signup.submitting : t.signup.submit}
          </PrimaryButton>
          <p className="text-xs leading-relaxed text-bone/45">{t.signup.privacy}</p>
        </div>
      </form>

      <p className="mt-6 text-sm text-bone/60">
        {t.signup.haveAccount}{" "}
        <Link href="/verify" className="font-semibold text-gold underline">
          {t.signup.haveAccountLink}
        </Link>
      </p>
    </SplitLayout>
  );
}
