"use client";

import { ProgressBar } from "@/app/components/ProgressBar";
import { GlassCard } from "@/app/components/GlassCard";
import { LocaleToggle } from "@/app/components/LocaleToggle";
import { PrimaryButton, GhostButton } from "@/app/components/PrimaryButton";
import { useI18n } from "@/lib/i18n";

/**
 * One question per screen. Content sits in a glass panel over the gradient;
 * the primary action stays in the thumb zone at the bottom.
 */
export function QuestionScreen({
  step,
  kicker,
  question,
  helper,
  children,
  onNext,
  onBack,
  nextDisabled,
}: {
  step: number;
  kicker: string;
  question: string;
  helper?: string;
  children: React.ReactNode;
  onNext: () => void;
  onBack?: () => void;
  nextDisabled: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-6 pb-8">
      <LocaleToggle className="mb-6 self-end border-white/30 text-white" />

      <ProgressBar step={step} />

      <GlassCard className="mt-6">
        <p className="ticker text-[10px] text-gold">{kicker}</p>
        <h2 className="display mt-3 text-[clamp(1.75rem,7vw,2.5rem)] text-bone">
          {question}
        </h2>
        {helper && <p className="mt-3 text-sm text-bone/60">{helper}</p>}
        <div className="mt-7">{children}</div>
      </GlassCard>

      <div className="mt-auto pt-8">
        <PrimaryButton onClick={onNext} disabled={nextDisabled}>
          {t("survey.next")}
        </PrimaryButton>
        {onBack && (
          <div className="mt-2 flex justify-center">
            <GhostButton onClick={onBack}>&larr; {t("survey.back")}</GhostButton>
          </div>
        )}
      </div>
    </div>
  );
}
