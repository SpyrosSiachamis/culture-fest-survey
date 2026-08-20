"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { confirmPasswordReset, errorMessage, isApiError } from "@/lib/api";
import { makeValidators } from "@/lib/validation";
import { useLang } from "@/components/LanguageProvider";
import { SplitLayout } from "../components/SplitLayout";
import { Notice, PasswordField } from "../components/Field";
import { PrimaryButton } from "../components/PrimaryButton";

/**
 * Step two: the screen the emailed link opens.
 *
 * `useSearchParams` makes the component that calls it client-rendered up to the nearest Suspense
 * boundary, so the form is wrapped in one — that keeps the rest of the route prerenderable and is
 * what the Next docs require for a static route that reads the query string.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetFallback() {
  const { t } = useLang();
  return (
    <SplitLayout>
      <p className="ticker text-[10px] text-gold">{t.resetPassword.eyebrow}</p>
      <div className="mt-5 flex flex-col gap-3" aria-label={t.common.loading}>
        <div className="h-8 w-2/3 animate-pulse bg-bone/12" />
        <div className="h-4 w-full animate-pulse bg-bone/8" />
      </div>
    </SplitLayout>
  );
}

function ResetPasswordForm() {
  const { t } = useLang();
  const v = makeValidators(t);
  const token = useSearchParams().get("token");

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmation?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Separate from `formError`: a dead link is not something to retry on this screen, so it replaces
  // the form with a way to get a new one rather than sitting above a form that can never succeed.
  const [linkDead, setLinkDead] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || !token) return;

    const errors = {
      password: v.password(password) ?? undefined,
      confirmation: password !== confirmation ? t.errors.passwordMismatch : undefined,
    };
    setFieldErrors(errors);
    if (errors.password || errors.confirmation) return;

    setSubmitting(true);
    setFormError(null);

    try {
      await confirmPasswordReset(token, password);
      setDone(true);
    } catch (caught) {
      if (isApiError(caught) && caught.status === "invalid_reset_token") {
        setLinkDead(true);
      } else {
        setFormError(errorMessage(caught));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <SplitLayout>
        <p className="ticker text-[10px] text-gold">{t.eyebrows.done}</p>
        <h2 className="display mt-3 text-4xl text-bone">{t.resetPassword.doneHeading}</h2>
        <p className="mt-3 text-sm text-bone/65">{t.resetPassword.doneBody}</p>

        <Link href="/" className="mt-8 block">
          <PrimaryButton type="button">{t.resetPassword.signIn}</PrimaryButton>
        </Link>
      </SplitLayout>
    );
  }

  // A dead link and a missing one land in the same place: there is nothing to do here but get a new
  // link. Only the explanation differs.
  if (linkDead || !token) {
    return (
      <SplitLayout>
        <p className="ticker text-[10px] text-gold">{t.resetPassword.eyebrow}</p>
        <h2 className="display mt-3 text-4xl text-bone">{t.resetPassword.invalidHeading}</h2>
        <p className="mt-3 text-sm text-bone/65">
          {linkDead ? t.resetPassword.invalidBody : t.resetPassword.missingToken}
        </p>

        <Link href="/forgot-password" className="mt-8 block">
          <PrimaryButton type="button">{t.resetPassword.requestNew}</PrimaryButton>
        </Link>
        <p className="mt-6 text-sm text-bone/60">
          <Link href="/" className="font-semibold text-gold underline">
            {t.forgotPassword.backToSignIn}
          </Link>
        </p>
      </SplitLayout>
    );
  }

  return (
    <SplitLayout>
      <p className="ticker text-[10px] text-gold">{t.resetPassword.eyebrow}</p>
      <h2 className="display mt-3 text-4xl text-bone">{t.resetPassword.heading}</h2>
      <p className="mt-3 text-sm text-bone/65">{t.resetPassword.intro}</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-6">
        {formError && <Notice tone="error">{formError}</Notice>}

        <PasswordField
          id="new-password"
          label={t.resetPassword.newPassword}
          autoComplete="new-password"
          value={password}
          error={fieldErrors.password}
          disabled={submitting}
          onChange={(event) => setPassword(event.target.value)}
        />

        <PasswordField
          id="confirm-password"
          label={t.resetPassword.confirmPassword}
          autoComplete="new-password"
          value={confirmation}
          error={fieldErrors.confirmation}
          disabled={submitting}
          onChange={(event) => setConfirmation(event.target.value)}
        />

        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? t.resetPassword.saving : t.resetPassword.submit}
        </PrimaryButton>
      </form>
    </SplitLayout>
  );
}
