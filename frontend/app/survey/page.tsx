"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { errorMessage, isApiError, submitSurvey } from "@/lib/api";
import {
  buildPayload,
  questionsFor,
  TOTAL_QUESTIONS,
  type Answers,
  type AudienceType,
  type Question,
} from "@/lib/survey";
import { useAuth } from "@/components/AuthProvider";
import { useLang } from "@/components/LanguageProvider";
import { questionCopy, type Dictionary } from "@/lib/i18n";
import { ChoiceCard } from "../components/ChoiceCard";
import { ChipGroup } from "../components/ChipGroup";
import { Notice } from "../components/Field";
import { GlassCard } from "../components/GlassCard";
import { LocaleToggle } from "../components/LocaleToggle";
import { PrimaryButton, GhostButton } from "../components/PrimaryButton";
import { ProgressBar } from "../components/ProgressBar";
import { ScaleGrid } from "../components/ScaleGrid";
import { StampBadge } from "../components/StampBadge";
import { TextArea } from "../components/TextArea";

const LETTERS = "ABCDEFGHI";

/** Full-bleed gradient behind every survey screen. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="fest-gradient fest-grain relative min-h-dvh">
      <div className="pointer-events-none absolute inset-0 bg-ink/45" />
      <div className="relative z-10">{children}</div>
    </main>
  );
}

/**
 * Survey wizard — one question per screen, with branch questions filtered in or out by the
 * audience answered first.
 *
 * The whole response is submitted in a single call at the end, because the backend validates the
 * conditional fields against each other and only accepts a complete payload.
 */
export default function SurveyPage() {
  const { t } = useLang();
  const { profile, status, initialising, refresh } = useAuth();
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Set when the backend rejects this submission because the account had already answered. Kept
  // apart from `submitted` so the screen can say so, and separate from `profile.has_voted` because
  // the refreshed profile has not arrived yet at the moment the rejection lands.
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyVoted = duplicate || (profile?.has_voted ?? false);
  const isDone = submitted || alreadyVoted;

  const audience = (answers.audience_type as AudienceType | undefined) ?? null;
  const questions = useMemo(() => questionsFor(audience), [audience]);
  const question = questions[Math.min(index, questions.length - 1)];
  // Before an audience is chosen the list holds only the first question, which would otherwise
  // make question one look like the final screen.
  const isLast = audience !== null && index === questions.length - 1;
  const copy = questionCopy(t, question.id);

  const answer = answers[question.id];
  const answered = Array.isArray(answer)
    ? answer.length > 0
    : answer !== undefined && answer !== null && answer !== "";
  const canAdvance = question.optional || answered;

  // Denominator stays at the full count until the audience narrows the path, so the counter never
  // appears to jump backwards mid-run.
  const total = audience ? questions.length : TOTAL_QUESTIONS;

  function setAnswer(value: Answers[keyof Answers]) {
    setAnswers((current) => ({ ...current, [question.id]: value }));
  }

  function toggleMulti(value: string) {
    const current = (answers[question.id] as string[] | undefined) ?? [];
    setAnswer(
      current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value]
    );
  }

  async function handleNext() {
    if (!isLast) {
      setIndex((current) => current + 1);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await submitSurvey(buildPayload(answers));
      setSubmitted(true);
      // Submitting is what earns the door pass, so the cached profile is now stale.
      void refresh();
    } catch (caught) {
      // "Already submitted" is a finished state, not a failure to retry — but it is not *this*
      // response finishing, so it must not claim the answers just typed were stored. The account
      // answered earlier (or a concurrent request won the atomic claim), and this payload was
      // discarded server-side.
      if (isApiError(caught) && caught.status === "already_submitted") {
        setDuplicate(true);
        void refresh();
        return;
      }
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  // Wait for the session check before deciding anything. Without this, a reload mid-survey would
  // show the sign-in gate for a moment to someone who is perfectly well signed in.
  if (initialising && !isDone) {
    return (
      <Shell>
        <div className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-5 py-10">
          <GlassCard className="w-full">
            <div className="flex flex-col gap-3" aria-label={t.common.loading}>
              <div className="h-8 w-2/3 animate-pulse bg-bone/12" />
              <div className="h-4 w-full animate-pulse bg-bone/8" />
            </div>
          </GlassCard>
        </div>
      </Shell>
    );
  }

  // Submission requires a live session, so there is no point letting someone fill in fifteen
  // screens and only then discover they are signed out.
  if (status !== "authenticated" && !isDone) {
    return (
      <Shell>
        <div className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-5 py-10">
          <GlassCard className="w-full">
            <p className="ticker text-[10px] text-gold">{t.eyebrows.login}</p>
            <h2 className="display mt-3 text-4xl text-bone">{t.gate.heading}</h2>
            <p className="mt-3 text-sm text-bone/70">{t.gate.body}</p>
            <div className="mt-8 flex flex-col gap-3">
              <Link href="/">
                <PrimaryButton type="button">{t.common.signIn}</PrimaryButton>
              </Link>
              <Link href="/signup" className="text-center">
                <GhostButton type="button" className="w-full">
                  {t.gate.createAccount}
                </GhostButton>
              </Link>
            </div>
          </GlassCard>
        </div>
      </Shell>
    );
  }

  if (isDone) {
    return (
      <Shell>
        <div className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-5 py-10">
          <GlassCard className="w-full">
            <div className="flex flex-col items-center gap-5 text-center">
              <StampBadge
                top={t.anon.badgeTop}
                main={t.anon.badgeMid}
                bottom={t.anon.badgeBottom}
                tone="gold"
              />
              <div>
                <h2 className="display text-4xl text-bone">
                  {submitted ? t.done.heading : t.already.heading}
                </h2>
                <p className="mt-3 text-sm text-bone/70">
                  {submitted ? t.done.body : t.already.body}
                </p>
              </div>
              <Notice tone="success">
                {submitted ? t.done.confirmation : t.already.notice}
              </Notice>
              <Link href="/profile" className="w-full">
                <PrimaryButton type="button">{t.common.profile}</PrimaryButton>
              </Link>
            </div>
          </GlassCard>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-6 pb-8">
        <LocaleToggle className="mb-6 self-end border-white/30 text-white" />

        <ProgressBar step={index + 1} total={total} />

        <GlassCard className="mt-6">
          <p className="ticker text-[10px] text-gold">{copy.eyebrow}</p>
          <h2 className="display mt-3 text-[clamp(1.75rem,7vw,2.5rem)] text-bone">{copy.title}</h2>
          {copy.description && <p className="mt-3 text-sm text-bone/60">{copy.description}</p>}

          <div className="mt-5 flex flex-col gap-3">
            {error && <Notice tone="error">{error}</Notice>}
            {copy.warning && <Notice tone="warning">{copy.warning}</Notice>}
            {copy.note && <Notice tone="info">{copy.note}</Notice>}
            {/* The anonymity guarantee is stated twice in the whole flow: once at signup, and here
                on the final screen — the moment someone is actually deciding to submit. It used to
                appear on every question screen, which is how it stopped being read. */}
            {isLast && <Notice tone="info">{t.anon.preSubmit}</Notice>}
          </div>

          <div className="mt-7">
            <QuestionBody
              question={question}
              answers={answers}
              t={t}
              onSet={setAnswer}
              onToggleMulti={toggleMulti}
            />
          </div>
        </GlassCard>

        <div className="mt-auto pt-8">
          <PrimaryButton type="button" disabled={!canAdvance || submitting} onClick={handleNext}>
            {isLast ? (submitting ? t.common.sending : t.common.submit) : t.common.next}
          </PrimaryButton>

          <div className="mt-2 flex justify-center gap-4">
            {index > 0 && (
              <GhostButton type="button" onClick={() => setIndex((current) => current - 1)}>
                &larr; {t.common.back}
              </GhostButton>
            )}
            {question.optional && !answered && (
              <GhostButton type="button" onClick={handleNext}>
                {t.common.skip}
              </GhostButton>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function QuestionBody({
  question,
  answers,
  t,
  onSet,
  onToggleMulti,
}: {
  question: Question;
  answers: Answers;
  t: Dictionary;
  onSet: (value: Answers[keyof Answers]) => void;
  onToggleMulti: (value: string) => void;
}) {
  const value = answers[question.id];
  const copy = questionCopy(t, question.id);

  switch (question.kind) {
    case "single":
      return (
        <div className="flex flex-col gap-3">
          {question.values.map((optionValue, position) => {
            const option = copy.options?.[optionValue];
            return (
              <ChoiceCard
                key={optionValue}
                marker={LETTERS[position]}
                label={option?.label ?? optionValue}
                hint={option?.description}
                selected={value === optionValue}
                onSelect={() => onSet(optionValue)}
              />
            );
          })}
        </div>
      );

    case "bool":
      return (
        <div className="flex flex-col gap-3">
          <ChoiceCard
            marker="A"
            label={copy.options?.yes.label ?? "Yes"}
            selected={value === true}
            onSelect={() => onSet(true)}
          />
          <ChoiceCard
            marker="B"
            label={copy.options?.no.label ?? "No"}
            selected={value === false}
            onSelect={() => onSet(false)}
          />
        </div>
      );

    case "scale":
      return (
        <ScaleGrid
          value={(value as number | undefined) ?? null}
          onChange={(score) => onSet(score)}
          lowLabel={copy.lowLabel ?? ""}
          highLabel={copy.highLabel ?? ""}
        />
      );

    case "multi":
      return (
        <ChipGroup
          options={question.values.map((optionValue) => ({
            value: optionValue,
            label: copy.options?.[optionValue]?.label ?? optionValue,
          }))}
          selected={(value as string[] | undefined) ?? []}
          onToggle={onToggleMulti}
        />
      );

    case "text":
      return (
        <TextArea
          label={question.optional ? t.common.optional : t.common.yourAnswer}
          value={(value as string | undefined) ?? ""}
          onChange={(next) => onSet(next)}
          placeholder={t.placeholders[question.placeholderKey]}
          maxLength={question.maxLength}
        />
      );
  }
}
