"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SplitLayout } from "@/app/components/SplitLayout";
import { PrimaryButton } from "@/app/components/PrimaryButton";
import { Field, FormError } from "@/app/components/Field";
import * as api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

export default function SignupPage() {
  const router = useRouter();
  const { setToken } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errorCode, setErrorCode] = useState<api.ErrorCode | null>(null);
  const [busy, setBusy] = useState(false);

  const ready =
    email.trim() !== "" && phone.trim() !== "" && password.length >= 8;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setErrorCode(null);
    try {
      await api.signup({ email: email.trim(), phone: phone.trim(), password });
      // Sign straight in so the respondent never sees a second form.
      const token = await api.login({ email: email.trim(), password });
      setToken(token);
      router.push("/survey");
    } catch (err) {
      setErrorCode(err instanceof api.ApiError ? err.code : "generic");
      setBusy(false);
    }
  }

  return (
    <SplitLayout>
      <h2 className="display text-4xl text-bone">{t("signup.title")}</h2>
      <p className="mt-3 text-sm text-bone/65">{t("signup.intro")}</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-6">
        <Field
          id="email"
          label={t("signup.email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t("signup.emailPlaceholder")}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          id="phone"
          label={t("signup.phone")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={t("signup.phonePlaceholder")}
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Field
          id="password"
          label={t("signup.password")}
          type="password"
          autoComplete="new-password"
          placeholder={t("signup.passwordPlaceholder")}
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={t("signup.passwordHint")}
        />

        <FormError message={errorCode && t(`errors.${errorCode}`)} />

        <PrimaryButton type="submit" disabled={!ready || busy}>
          {busy ? t("signup.submitBusy") : t("signup.submit")}
        </PrimaryButton>
      </form>

      <p className="mt-6 text-sm text-bone/60">
        {t("signup.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-gold underline">
          {t("signup.login")}
        </Link>
      </p>
    </SplitLayout>
  );
}
