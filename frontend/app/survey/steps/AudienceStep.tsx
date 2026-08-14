"use client";

import { ChoiceCard } from "@/app/components/ChoiceCard";
import { useI18n } from "@/lib/i18n";
import type { AudienceType } from "@/lib/types";

/**
 * Question 1. This answer branches the rest of the wizard: tourists get the
 * transport / accommodation questions, students get the student-pass question.
 */
const OPTIONS: { value: AudienceType; marker: string }[] = [
  { value: "student", marker: "A" },
  { value: "tourist", marker: "B" },
  { value: "local", marker: "C" },
];

export function AudienceStep({
  value,
  onChange,
}: {
  value: AudienceType | null;
  onChange: (v: AudienceType) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-3">
      {OPTIONS.map((o) => (
        <ChoiceCard
          key={o.value}
          marker={o.marker}
          label={t(`survey.q1.${o.value}`)}
          hint={t(`survey.q1.${o.value}Hint`)}
          selected={value === o.value}
          onSelect={() => onChange(o.value)}
        />
      ))}
    </div>
  );
}
