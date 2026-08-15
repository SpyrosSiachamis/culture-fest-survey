"use client";

import Link from "next/link";
import { useState } from "react";

import { errorMessage, isApiError, login } from "@/lib/api";
import { makeValidators } from "@/lib/validation";
import { useAuth } from "@/components/AuthProvider";
import { useLang } from "@/components/LanguageProvider";
import { SplitLayout } from "./components/SplitLayout";
import { Field, Notice, PasswordField } from "./components/Field";
import { PrimaryButton, GhostButton } from "./components/PrimaryButton";

/** Sign-in is the front door: `/` renders it directly, and `/login` redirects here. */
export default function HomePage() {
  const { t } = useLang();
  const { profile, status, initialising, refresh } = useAuth();
  const v = makeValidators(t);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<{ status: string; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Signed in either because the form was just submitted, or because the session restored itself
  // from the cookie when the page loaded — a refresh lands here, not back on the form.
  const signedIn = status === "authenticated";

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
      // The session cookie is set by this call; `refresh` then reads back who the cookie says we
      // are, so the signed-in state comes from the server rather than from having posted a form.
      await login({ email: email.trim(), password });
      await refresh();
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
    // Someone who has already answered has nothing to start, so the pass is the main action.
    const surveyDone = profile?.has_voted ?? false;

    return (
      <SplitLayout>
        <p className="ticker text-[10px] text-gold">{t.eyebrows.done}</p>
        <h2 className="display mt-3 text-4xl text-bone">{t.login.signedInHeading}</h2>
        <p className="mt-3 text-sm text-bone/65">
          {surveyDone ? t.done.body : t.login.signedInBody}
        </p>
        <Link href={surveyDone ? "/profile" : "/survey"} className="mt-8 block">
          <PrimaryButton type="button">
            {surveyDone ? t.common.profile : t.login.startSurvey}
          </PrimaryButton>
        </Link>
        <Link href={surveyDone ? "/survey" : "/profile"} className="mt-3 block text-center">
          <GhostButton type="button" className="w-full">
            {surveyDone ? t.profile.backToSurvey : t.common.profile}
          </GhostButton>
        </Link>
      </SplitLayout>
    );
  }

  // Nothing is known about the session yet. Rendering the form here would flash a sign-in screen
  // at somebody who is already signed in, every single reload.
  if (initialising) {
    return (
      <SplitLayout>
        <p className="ticker text-[10px] text-gold">{t.eyebrows.login}</p>
        <div className="mt-5 flex flex-col gap-3" aria-label={t.common.loading}>
          <div className="h-8 w-2/3 animate-pulse bg-bone/12" />
          <div className="h-4 w-full animate-pulse bg-bone/8" />
        </div>
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

        <PasswordField
          id="password"
          label={t.login.password}
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
