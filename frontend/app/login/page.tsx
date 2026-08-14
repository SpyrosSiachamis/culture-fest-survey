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

export default function LoginPage() {
  const router = useRouter();
  const { setToken } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorCode, setErrorCode] = useState<api.ErrorCode | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = email.trim() !== "" && password !== "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setErrorCode(null);
    try {
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
      <h2 className="display text-4xl text-bone">{t("login.title")}</h2>
      <p className="mt-3 text-sm text-bone/65">{t("login.intro")}</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-6">
        <Field
          id="email"
          label={t("login.email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t("login.emailPlaceholder")}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          id="password"
          label={t("login.password")}
          type="password"
          autoComplete="current-password"
          placeholder={t("login.passwordPlaceholder")}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <FormError message={errorCode && t(`errors.${errorCode}`)} />

        <PrimaryButton type="submit" disabled={!ready || busy}>
          {busy ? t("login.submitBusy") : t("login.submit")}
        </PrimaryButton>
      </form>

      <p className="mt-6 text-sm text-bone/60">
        {t("login.noAccount")}{" "}
        <Link href="/signup" className="font-semibold text-gold underline">
          {t("login.signup")}
        </Link>
      </p>
    </SplitLayout>
  );
}
