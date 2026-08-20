"use client";

import Link from "next/link";
import { useState } from "react";

import { PASSWORD_RESET_TTL_MINUTES, errorMessage, isApiError, requestPasswordReset } from "@/lib/api";
import { makeValidators } from "@/lib/validation";
import { useLang } from "@/components/LanguageProvider";
import { format } from "@/lib/i18n";
import { SplitLayout } from "../components/SplitLayout";
import { Field, Notice } from "../components/Field";
import { PrimaryButton } from "../components/PrimaryButton";

/**
 * Step one of the reset: hand over an address, get a link.
 *
 * The confirmation below is written by this page, not taken from the response. The endpoint answers
 * identically whether or not the address has an account — that is the whole point of it — and
 * echoing anything it returned would be the one way to undo that from the client side.
 */
export default function ForgotPasswordPage() {
  const { t } = useLang();
  const v = makeValidators(t);

  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const error = v.email(email) ?? undefined;
    setFieldError(error);
    if (error) return;

    setSubmitting(true);
    setFormError(null);

    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (caught) {
      // Only failures that mean the request never landed are worth showing, and neither of them
      // says anything about the address. Anything else falls through to the same confirmation a
      // success gets, so a probe cannot tell the outcomes apart from the UI either.
      if (isApiError(caught) && (caught.status === "rate_limited" || caught.status === "network_error")) {
        setFormError(errorMessage(caught));
      } else {
        setSent(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <SplitLayout>
        <p className="ticker text-[10px] text-gold">{t.eyebrows.done}</p>
        <h2 className="display mt-3 text-4xl text-bone">{t.forgotPassword.sentHeading}</h2>
        <p className="mt-3 text-sm text-bone/65">
          {format(t.forgotPassword.sentBody, { minutes: PASSWORD_RESET_TTL_MINUTES })}
        </p>
        <p className="mt-4 text-sm text-bone/50">{t.forgotPassword.sentHint}</p>

        <Link href="/" className="mt-8 block">
          <PrimaryButton type="button">{t.forgotPassword.backToSignIn}</PrimaryButton>
        </Link>
      </SplitLayout>
    );
  }

  return (
    <SplitLayout>
      <p className="ticker text-[10px] text-gold">{t.forgotPassword.eyebrow}</p>
      <h2 className="display mt-3 text-4xl text-bone">{t.forgotPassword.heading}</h2>
      <p className="mt-3 text-sm text-bone/65">{t.forgotPassword.intro}</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-6">
        {formError && <Notice tone="error">{formError}</Notice>}

        <Field
          id="email"
          label={t.login.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t.signup.emailPlaceholder}
          value={email}
          error={fieldError}
          disabled={submitting}
          onChange={(event) => setEmail(event.target.value)}
        />

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? t.forgotPassword.sending : t.forgotPassword.submit}
        </PrimaryButton>
      </form>

      <p className="mt-6 text-sm text-bone/60">
        <Link href="/" className="font-semibold text-gold underline">
          {t.forgotPassword.backToSignIn}
        </Link>
      </p>
    </SplitLayout>
  );
}
