"use client";

import Link from "next/link";
import { useState } from "react";

import { errorMessage, isApiError, login } from "@/lib/api";
import { setAccessToken } from "@/lib/session";
import { makeValidators } from "@/lib/validation";
import { useLang } from "@/components/LanguageProvider";
import { SplitLayout } from "./components/SplitLayout";
import { Field, Notice } from "./components/Field";
import { PrimaryButton } from "./components/PrimaryButton";

/** Sign-in is the front door: `/` renders it directly, and `/login` redirects here. */
export default function HomePage() {
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
      <SplitLayout>
        <p className="ticker text-[10px] text-gold">{t.eyebrows.done}</p>
        <h2 className="display mt-3 text-4xl text-bone">{t.login.signedInHeading}</h2>
        <p className="mt-3 text-sm text-bone/65">{t.login.signedInBody}</p>
        <Link href="/survey" className="mt-8 block">
          <PrimaryButton type="button">{t.login.startSurvey}</PrimaryButton>
        </Link>
      </SplitLayout>
    );
  }

  return (
    <SplitLayout>
      <p className="ticker text-[10px] text-gold">{t.eyebrows.login}</p>
      <h2 className="display mt-3 text-4xl text-bone">{t.login.heading}</h2>
      <p className="mt-3 text-sm text-bone/65">{t.login.intro}</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-6">
        {error && (
          <Notice tone={needsVerification ? "info" : "error"}>
            {error.message}
            {needsVerification && (
              <>
                {" "}
                <Link href="/verify" className="font-semibold text-gold underline">
                  {t.login.enterCode}
                </Link>
              </>
            )}
          </Notice>
        )}

        <Field
          id="email"
          label={t.login.email}
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
          id="password"
          label={t.login.password}
          type="password"
          autoComplete="current-password"
          value={password}
          error={fieldErrors.password}
          disabled={submitting}
          onChange={(event) => setPassword(event.target.value)}
        />

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? t.common.signingIn : t.common.signIn}
        </PrimaryButton>
      </form>

      <p className="mt-6 text-sm text-bone/60">
        {t.login.noAccount}{" "}
        <Link href="/signup" className="font-semibold text-gold underline">
          {t.login.noAccountLink}
        </Link>
      </p>
    </SplitLayout>
  );
}
