"use client";

import { useMemo, useState } from "react";

import { errorMessage, isApiError, submitSurvey } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import {
  buildPayload,
  questionsFor,
  TOTAL_QUESTIONS,
  type Answers,
  type AudienceType,
  type Question,
} from "@/lib/survey";
import { useLang } from "@/components/LanguageProvider";
import type { Dictionary } from "@/lib/i18n";
import {
  Alert,
  Button,
  ChipGroup,
  FestivalShell,
  InlineLink,
  OptionCard,
  ProgressHeader,
  ScaleGrid,
  Stamp,
  TextAction,
  TextArea,
} from "@/components/ui";

const LETTERS = "ABCDEFGHI";

/**
 * Survey wizard — one question per screen, with branch questions filtered in or out by the
 * audience answered first.
 *
 * The whole response is submitted in a single call at the end, because the backend validates the
 * conditional fields against each other and only accepts a complete payload.
 */
export default function SurveyPage() {
  const { t } = useLang();
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audience = (answers.audience_type as AudienceType | undefined) ?? null;
  const questions = useMemo(() => questionsFor(audience), [audience]);
  const question = questions[Math.min(index, questions.length - 1)];
  // Before an audience is chosen the list holds only the first question, which would otherwise
  // make question one look like the final screen.
  const isLast = audience !== null && index === questions.length - 1;
  const copy = t.survey[question.id];

  const answer = answers[question.id];
  const answered = Array.isArray(answer)
    ? answer.length > 0
    : answer !== undefined && answer !== null && answer !== "";
  const canAdvance = question.optional || answered;

  // Denominator stays at the full count until the audience narrows the path, so the counter never
  // appears to jump backwards mid-run.
  const total = audience ? questions.length : TOTAL_QUESTIONS;
  const percent = Math.round(((index + 1) / total) * 100);

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
    } catch (caught) {
      // "Already submitted" is a finished state, not a failure to retry.
      if (isApiError(caught) && caught.status === "already_submitted") {
        setSubmitted(true);
        return;
      }
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  // Submission needs a bearer token, so there is no point letting someone fill in fifteen screens
  // and only then discover they are signed out.
  if (!getAccessToken() && !submitted) {
    return (
      <FestivalShell eyebrow={t.eyebrows.login} title={t.gate.heading} description={t.gate.body}>
        <div className="flex flex-col gap-3">
          <InlineLink href="/login">
            <Button type="button">{t.common.signIn}</Button>
          </InlineLink>
          <InlineLink href="/signup">
            <Button type="button" variant="secondary">
              {t.gate.createAccount}
            </Button>
          </InlineLink>
        </div>
      </FestivalShell>
    );
  }

  if (submitted) {
    return (
      <FestivalShell eyebrow={t.eyebrows.done} title={t.done.heading} description={t.done.body}>
        <div className="flex flex-col items-center gap-5">
          <Stamp
            top={t.anon.badgeTop}
            value={t.anon.badgeMid}
            bottom={t.anon.badgeBottom}
            size="lg"
            tone="gold"
          />
          <Alert tone="success">{t.done.confirmation}</Alert>
        </div>
      </FestivalShell>
    );
  }

  return (
    <FestivalShell
      progress={
        <ProgressHeader
          stampTop={t.common.step}
          stampValue={t.common.stepOf(index + 1, total)}
          stampBottom={t.common.anonymous}
          percent={percent}
          caption={`${t.common.percentComplete(percent)} — ${t.common.noAnswerLinked}`}
        />
      }
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      footer={
        index > 0 ? (
          <TextAction arrow onClick={() => setIndex((current) => current - 1)}>
            {t.common.back}
          </TextAction>
        ) : undefined
      }
    >
      {error && <Alert tone="error">{error}</Alert>}
      {copy.warning && <Alert tone="warning">{copy.warning}</Alert>}
      {copy.note && <Alert tone="info">{copy.note}</Alert>}

      <QuestionBody
        question={question}
        answers={answers}
        t={t}
        onSet={setAnswer}
        onToggleMulti={toggleMulti}
      />

      <div className="flex flex-col gap-2">
        <Button type="button" disabled={!canAdvance} loading={submitting} onClick={handleNext}>
          {isLast ? (submitting ? t.common.sending : t.common.submit) : t.common.next}
        </Button>

        {question.optional && !answered && (
          <TextAction onClick={handleNext}>{t.common.skip}</TextAction>
        )}
      </div>
    </FestivalShell>
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
  const copy = t.survey[question.id];

  switch (question.kind) {
    case "single":
      return (
        <div className="flex flex-col gap-3">
          {question.values.map((optionValue, position) => {
            const option = copy.options?.[optionValue];
            return (
              <OptionCard
                key={optionValue}
                letter={LETTERS[position]}
                label={option?.label ?? optionValue}
                description={option?.description}
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
          <OptionCard
            letter="A"
            label={copy.options?.yes.label ?? "Yes"}
            selected={value === true}
            onSelect={() => onSet(true)}
          />
          <OptionCard
            letter="B"
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
