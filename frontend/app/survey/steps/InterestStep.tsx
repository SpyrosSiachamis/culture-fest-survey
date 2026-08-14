"use client";

import { ScaleGrid } from "@/app/components/ScaleGrid";
import { useI18n } from "@/lib/i18n";

/** Question 4 in the final order — used here as the second test screen because
 *  it exercises the 1–10 grid pattern that four other questions reuse. */
export function InterestStep({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  const { t } = useI18n();

  return (
    <ScaleGrid
      value={value}
      onChange={onChange}
      lowLabel={t("survey.q2.low")}
      highLabel={t("survey.q2.high")}
    />
  );
}
