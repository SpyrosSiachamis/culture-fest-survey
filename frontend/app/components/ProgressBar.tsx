"use client";

import { StampBadge } from "./StampBadge";
import { useLang } from "@/components/LanguageProvider";
import { format } from "@/lib/i18n";

/**
 * Step stamp plus a gradient rule.
 *
 * `total` is passed in rather than read from a constant because the wizard's length depends on the
 * audience branch chosen in question one.
 *
 * Carries no anonymity wording. It used to — the stamp read "Anonymous" and the caption repeated
 * "no answer is linked to you" — but this renders on every question screen, so the guarantee was
 * being restated a dozen times over and had stopped registering. It is now made once at signup and
 * once again just before submit, where someone is actually deciding to commit.
 */
export function ProgressBar({ step, total }: { step: number; total: number }) {
  const { t } = useLang();
  const pct = Math.round((step / total) * 100);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex items-center gap-4">
      <StampBadge
        top={t.common.step}
        main={format(t.common.stepOf, { current: pad(step), total: pad(total) })}
        className="size-16"
      />
      <div className="min-w-0 flex-1">
        <div
          className="h-2 w-full overflow-hidden bg-bone/12"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={total}
        >
          <div
            className="h-full bg-linear-to-r from-magenta via-orange to-gold transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="ticker mt-2 text-[10px] text-bone/50">
          {format(t.common.percentComplete, { percent: pct })}
        </p>
      </div>
    </div>
  );
}
