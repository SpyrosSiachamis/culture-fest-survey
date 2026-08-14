"use client";

import { useState } from "react";

import { errorMessage, isApiError, login } from "@/lib/api";
import { setAccessToken } from "@/lib/session";
import { makeValidators } from "@/lib/validation";
import { useLang } from "@/components/LanguageProvider";
import { Alert, Button, FestivalShell, InlineLink, Input } from "@/components/ui";

export default function LoginPage() {
  const { t } = useLang();
  const v = makeValidators(t);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<{ status: string; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  // The backend answers 403 with this status when the password was right but the address was
  // never confirmed — the one case where we can safely point the user somewhere specific.
  const needsVerification = error?.status === "email_not_verified";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const errors = {
      email: v.email(email) ?? undefined,
      password: v.passwordPresent(password) ?? undefined,
    };
    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await login({ email: email.trim(), password });
      setAccessToken(response.access_token);
      setSignedIn(true);
    } catch (caught) {
      setError({
        status: isApiError(caught) ? caught.status : "error",
        message: errorMessage(caught),
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (signedIn) {
    return (
      <FestivalShell
        eyebrow={t.eyebrows.done}
        title={t.login.signedInHeading}
        description={t.login.signedInBody}
      >
        <InlineLink href="/survey">
          <Button type="button">{t.login.startSurvey}</Button>
        </InlineLink>
      </FestivalShell>
    );
  }

  return (
    <FestivalShell
      eyebrow={t.eyebrows.login}
      title={t.login.heading}
      description={t.login.intro}
      footer={
        <p className="text-center text-sm text-fest-cream/70">
          {t.login.noAccount} <InlineLink href="/signup">{t.login.noAccountLink}</InlineLink>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        {error && (
          <Alert tone={needsVerification ? "info" : "error"}>
            {error.message}
            {needsVerification && (
              <> <InlineLink href="/verify">{t.login.enterCode}</InlineLink></>
            )}
          </Alert>
        )}

        <Input
          label={t.login.email}
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
          label={t.login.password}
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          error={fieldErrors.password}
          disabled={submitting}
          onChange={(event) => setPassword(event.target.value)}
        />

        <Button type="submit" loading={submitting}>
          {submitting ? t.common.signingIn : t.common.signIn}
        </Button>
      </form>
    </FestivalShell>
  );
}
