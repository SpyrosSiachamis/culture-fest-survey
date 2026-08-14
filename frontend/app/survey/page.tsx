"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { errorMessage, isApiError, submitSurvey } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import {
  buildPayload,
  questionsFor,
  type Answers,
  type AudienceType,
  type Question,
} from "@/lib/survey";
import {
  Alert,
  Button,
  ChipGroup,
  FestivalShell,
  OptionCard,
  ProgressBar,
  ScaleGrid,
  Stamp,
  TextArea,
} from "@/components/ui";

/**
 * Survey wizard — one question per screen, with the branch questions filtered in or out by the
 * audience answered first.
 *
 * The whole response is submitted in a single call at the end, because the backend validates the
 * conditional fields against each other and only accepts a complete payload.
 */
export default function SurveyPage() {
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audience = (answers.audience_type as AudienceType | undefined) ?? null;
  const questions = useMemo(() => questionsFor(audience), [audience]);
  const question = questions[Math.min(index, questions.length - 1)];
  const isLast = index === questions.length - 1;

  const answer = answers[question.id];
  const answered = Array.isArray(answer)
    ? answer.length > 0
    : answer !== undefined && answer !== null && answer !== "";
  const canAdvance = question.optional || answered;

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

  // Submission needs a bearer token, so there is no point letting someone fill in sixteen screens
  // and only then discover they are signed out.
  if (!getAccessToken() && !submitted) {
    return (
      <FestivalShell
        title="Sign in first"
        description="The survey is one response per account, so we need you signed in before you start."
        stamp={<Stamp top="Culture" value="FEST" bottom="Crete" />}
      >
        <div className="flex flex-col gap-3">
          <Link href="/login" className="contents">
            <Button type="button">Sign in</Button>
          </Link>
          <Link href="/signup" className="contents">
            <Button type="button" variant="secondary">
              Create an account
            </Button>
          </Link>
        </div>
      </FestivalShell>
    );
  }

  if (submitted) {
    return (
      <FestivalShell
        title="That's it"
        description="Your answers are in. Thanks for helping shape the night."
        stamp={<Stamp top="Status" value="OK" bottom="sent" tone="gold" />}
      >
        <div className="flex flex-col gap-4">
          <Alert tone="success">
            Response submitted. It is stored with no link back to your account — we cannot tell
            which answers were yours.
          </Alert>
        </div>
      </FestivalShell>
    );
  }

  return (
    <FestivalShell
      title={question.title}
      description={question.description}
      stamp={
        <Stamp top="Question" value={index + 1} bottom={`of ${questions.length}`} />
      }
      footer={<ProgressBar current={index + 1} total={questions.length} />}
    >
      <div className="flex flex-col gap-5">
        {error && <Alert tone="error">{error}</Alert>}
        {question.warning && <Alert tone="warning">{question.warning}</Alert>}
        {question.note && <Alert tone="info">{question.note}</Alert>}

        <QuestionBody
          question={question}
          answers={answers}
          onSet={setAnswer}
          onToggleMulti={toggleMulti}
        />

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            disabled={!canAdvance}
            loading={submitting}
            onClick={handleNext}
          >
            {isLast ? (submitting ? "Sending" : "Submit") : "Next"}
          </Button>

          {question.optional && !answered && (
            <button
              type="button"
              onClick={handleNext}
              className="min-h-11 text-sm text-white/70 underline underline-offset-4 transition-colors hover:text-white"
            >
              Skip this one
            </button>
          )}

          {index > 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIndex((current) => current - 1)}
            >
              Back
            </Button>
          )}
        </div>
      </div>
    </FestivalShell>
  );
}

function QuestionBody({
  question,
  answers,
  onSet,
  onToggleMulti,
}: {
  question: Question;
  answers: Answers;
  onSet: (value: Answers[keyof Answers]) => void;
  onToggleMulti: (value: string) => void;
}) {
  const value = answers[question.id];

  switch (question.kind) {
    case "single":
      return (
        <div className="flex flex-col gap-3">
          {question.options.map((option) => (
            <OptionCard
              key={option.value}
              label={option.label}
              description={option.description}
              selected={value === option.value}
              onSelect={() => onSet(option.value)}
            />
          ))}
        </div>
      );

    case "bool":
      return (
        <div className="flex flex-col gap-3">
          <OptionCard
            label={question.trueLabel}
            selected={value === true}
            onSelect={() => onSet(true)}
          />
          <OptionCard
            label={question.falseLabel}
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
          lowLabel={question.lowLabel}
          highLabel={question.highLabel}
        />
      );

    case "multi":
      return (
        <ChipGroup
          options={question.options}
          selected={(value as string[] | undefined) ?? []}
          onToggle={onToggleMulti}
        />
      );

    case "text":
      return (
        <TextArea
          label={question.optional ? "Optional" : "Your answer"}
          value={(value as string | undefined) ?? ""}
          onChange={(next) => onSet(next)}
          placeholder={question.placeholder}
          maxLength={question.maxLength}
        />
      );
  }
}
