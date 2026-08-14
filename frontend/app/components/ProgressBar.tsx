"use client";

import { StampBadge } from "./StampBadge";
import { TOTAL_STEPS } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

export function ProgressBar({ step }: { step: number }) {
  const { t } = useI18n();
  const pct = Math.round((step / TOTAL_STEPS) * 100);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex items-center gap-4">
      <StampBadge
        top={t("survey.stampTop")}
        main={`${pad(step)}/${pad(TOTAL_STEPS)}`}
        bottom={t("survey.stampBottom")}
        className="size-16"
      />
      <div className="min-w-0 flex-1">
        <div
          className="h-2 w-full overflow-hidden bg-bone/12"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
        >
          <div
            className="h-full bg-linear-to-r from-magenta via-orange to-gold transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="ticker mt-2 text-[10px] text-bone/50">
          {t("survey.progress", { pct })}
        </p>
      </div>
    </div>
  );
}
