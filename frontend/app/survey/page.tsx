"use client";

import { useState } from "react";

import {
  Alert,
  Button,
  FestivalShell,
  OptionCard,
  ProgressBar,
  ScaleGrid,
  Stamp,
} from "@/components/ui";

/**
 * Survey wizard — one question per screen.
 *
 * Only the first two questions are built here; this is the styling and interaction pattern the
 * remaining fourteen follow. Nothing is submitted yet: `POST /surveys/submit` validates the whole
 * response in one payload, so the call belongs on the last screen, not this one.
 */

const TOTAL_QUESTIONS = 16;

type AudienceType = "student" | "tourist" | "local";

const AUDIENCE_OPTIONS: {
  value: AudienceType;
  label: string;
  description: string;
  /** What the branch adds later on, per the conditional fields the backend enforces. */
  branchNote: string;
}[] = [
  {
    value: "student",
    label: "Student",
    description: "Studying in or around Hersonissos",
    branchNote: "We'll ask one extra question about your student transport pass.",
  },
  {
    value: "tourist",
    label: "Tourist",
    description: "Visiting the area",
    branchNote: "We'll ask about transport (€2 flat) and, optionally, where you're staying.",
  },
  {
    value: "local",
    label: "Local",
    description: "Living here year-round",
    branchNote: "",
  },
];

export default function SurveyPage() {
  const [step, setStep] = useState(1);
  const [audience, setAudience] = useState<AudienceType | null>(null);
  const [interest, setInterest] = useState<number | null>(null);

  const selectedAudience = AUDIENCE_OPTIONS.find((option) => option.value === audience);

  if (step === 1) {
    return (
      <FestivalShell
        title="Which one are you?"
        description="This shapes the rest of the questions, so start here."
        stamp={<Stamp top="Question" value="1" bottom={`of ${TOTAL_QUESTIONS}`} />}
        footer={<ProgressBar current={1} total={TOTAL_QUESTIONS} />}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {AUDIENCE_OPTIONS.map((option) => (
              <OptionCard
                key={option.value}
                label={option.label}
                description={option.description}
                selected={audience === option.value}
                onSelect={() => setAudience(option.value)}
              />
            ))}
          </div>

          {selectedAudience?.branchNote && (
            <Alert tone="info">{selectedAudience.branchNote}</Alert>
          )}

          <Button type="button" disabled={!audience} onClick={() => setStep(2)}>
            Next
          </Button>
        </div>
      </FestivalShell>
    );
  }

  if (step === 2) {
    return (
      <FestivalShell
        title="How into this are you?"
        description="1 means you'd skip it, 10 means you're already telling your friends."
        stamp={<Stamp top="Question" value="2" bottom={`of ${TOTAL_QUESTIONS}`} />}
        footer={<ProgressBar current={2} total={TOTAL_QUESTIONS} />}
      >
        <div className="flex flex-col gap-6">
          <ScaleGrid
            value={interest}
            onChange={setInterest}
            lowLabel="Not for me"
            highLabel="Take my money"
          />

          <div className="flex flex-col gap-3">
            <Button type="button" disabled={!interest} onClick={() => setStep(3)}>
              Next
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
          </div>
        </div>
      </FestivalShell>
    );
  }

  return (
    <FestivalShell
      title="That's the pattern"
      description="The remaining questions follow this same one-per-screen shape."
      stamp={<Stamp top="Preview" value="2" bottom={`of ${TOTAL_QUESTIONS}`} tone="gold" />}
      footer={<ProgressBar current={2} total={TOTAL_QUESTIONS} />}
    >
      <div className="flex flex-col gap-4">
        <Alert tone="info">
          Preview build — questions 3 to {TOTAL_QUESTIONS} are not wired up yet, and nothing has
          been submitted. Your answers so far: {selectedAudience?.label}, interest {interest}/10.
        </Alert>
        <Button type="button" variant="secondary" onClick={() => setStep(1)}>
          Start over
        </Button>
      </div>
    </FestivalShell>
  );
}
