"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QuestionScreen } from "./QuestionScreen";
import { AudienceStep } from "./steps/AudienceStep";
import { InterestStep } from "./steps/InterestStep";
import { GlassCard } from "@/app/components/GlassCard";
import { StampBadge } from "@/app/components/StampBadge";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import * as api from "@/lib/api";
import { emptyAnswers, type SurveyAnswers } from "@/lib/types";

type Gate = "checking" | "open" | "voted" | "expired";

export default function SurveyPage() {
  const router = useRouter();
  const { token, setToken } = useAuth();
  const { t } = useI18n();
  const [gate, setGate] = useState<Gate>("checking");
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<SurveyAnswers>(emptyAnswers);

  useEffect(() => {
    // In-memory token: a hard refresh drops it, so send them back to log in.
    if (!token) {
      router.replace("/login");
      return;
    }
    let active = true;
    api
      .hasVoted(token)
      .then((voted) => active && setGate(voted ? "voted" : "open"))
      .catch((err) => {
        if (!active) return;
        if (err instanceof api.ApiError && err.status === 401) {
          setToken(null);
          setGate("expired");
        } else {
          // Don't block the survey on a flaky has-voted check; /surveys/submit
          // enforces the one-vote rule anyway (409).
          setGate("open");
        }
      });
    return () => {
      active = false;
    };
  }, [token, router, setToken]);

  const set = <K extends keyof SurveyAnswers>(key: K, v: SurveyAnswers[K]) =>
    setAnswers((prev) => ({ ...prev, [key]: v }));

  if (gate === "checking") return <Shell>{null}</Shell>;

  if (gate === "voted") {
    return (
      <Shell>
        <Notice
          stamp={t("survey.voted.stamp")}
          title={t("survey.voted.title")}
          body={t("survey.voted.body")}
        />
      </Shell>
    );
  }

  if (gate === "expired") {
    return (
      <Shell>
        <Notice
          stamp={t("survey.expired.stamp")}
          title={t("survey.expired.title")}
          body={t("survey.expired.body")}
          action={{ href: "/login", label: t("survey.expired.action") }}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      {step === 1 && (
        <QuestionScreen
          step={1}
          kicker={t("survey.q1.kicker")}
          question={t("survey.q1.question")}
          helper={t("survey.q1.helper")}
          nextDisabled={answers.audience_type === null}
          onNext={() => setStep(2)}
        >
          <AudienceStep
            value={answers.audience_type}
            onChange={(v) => set("audience_type", v)}
          />
        </QuestionScreen>
      )}

      {step === 2 && (
        <QuestionScreen
          step={2}
          kicker={t("survey.q2.kicker")}
          question={t("survey.q2.question")}
          helper={t("survey.q2.helper")}
          nextDisabled={answers.interest_level === null}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        >
          <InterestStep
            value={answers.interest_level}
            onChange={(v) => set("interest_level", v)}
          />
        </QuestionScreen>
      )}

      {step === 3 && (
        <Notice
          stamp={t("survey.preview.stamp")}
          title={t("survey.preview.title")}
          body={t("survey.preview.body", {
            audience: t(`survey.q1.${answers.audience_type}`),
            interest: answers.interest_level ?? "-",
          })}
          action={{ href: "/", label: t("survey.preview.action") }}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="fest-gradient fest-grain relative min-h-dvh">
      <div className="pointer-events-none absolute inset-0 bg-ink/45" />
      <div className="relative z-10">{children}</div>
    </main>
  );
}

function Notice({
  stamp,
  title,
  body,
  action,
}: {
  stamp: string;
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-5 py-10">
      <GlassCard className="w-full">
        <StampBadge
          top={t("survey.statusStamp")}
          main={stamp}
          bottom={t("survey.stampBottom")}
        />
        <h2 className="display mt-6 text-4xl text-bone">{title}</h2>
        <p className="mt-3 text-sm text-bone/70">{body}</p>
        {action && (
          <Link
            href={action.href}
            className="notch-sm display mt-8 flex min-h-14 w-full items-center justify-center bg-gold px-6 text-lg text-ink"
          >
            {action.label}
          </Link>
        )}
      </GlassCard>
    </div>
  );
}
