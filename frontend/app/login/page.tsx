"use client";

import { useState } from "react";

import { errorMessage, isApiError, login } from "@/lib/api";
import { setAccessToken } from "@/lib/session";
import { validateEmail } from "@/lib/validation";
import { Alert, Button, FestivalShell, Input, Stamp } from "@/components/ui";

export default function LoginPage() {
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
      email: validateEmail(email) ?? undefined,
      // Only checked for presence: never hint at the password rules on a sign-in form.
      password: password ? undefined : "Enter your password.",
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
        title="You're in"
        description="Signed in and ready. The survey takes about two minutes."
        stamp={<Stamp top="Ready" value="GO" tone="gold" />}
      >
        <div className="flex flex-col gap-4">
          <Alert tone="success">Signed in successfully.</Alert>
          <a href="/survey" className="contents">
            <Button type="button">Start the survey</Button>
          </a>
        </div>
      </FestivalShell>
    );
  }

  return (
    <FestivalShell
      title="Sign in"
      description="Welcome back. Sign in to pick up where you left off."
      stamp={<Stamp top="Culture" value="FEST" bottom="Crete" />}
      footer={
        <p className="text-center text-sm text-white/70">
          No account yet?{" "}
          <a href="/signup" className="font-semibold text-fest-gold underline underline-offset-4">
            Sign up here
          </a>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {error && (
          <Alert tone={needsVerification ? "info" : "error"}>
            {error.message}
            {needsVerification && (
              <>
                {" "}
                <a href="/verify" className="font-semibold text-fest-gold underline underline-offset-4">
                  Enter your code
                </a>
              </>
            )}
          </Alert>
        )}

        <Input
          label="Email address"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          error={fieldErrors.email}
          disabled={submitting}
          onChange={(event) => setEmail(event.target.value)}
        />

        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          error={fieldErrors.password}
          disabled={submitting}
          onChange={(event) => setPassword(event.target.value)}
        />

        <Button type="submit" loading={submitting}>
          {submitting ? "Signing in" : "Sign in"}
        </Button>
      </form>
    </FestivalShell>
  );
}
