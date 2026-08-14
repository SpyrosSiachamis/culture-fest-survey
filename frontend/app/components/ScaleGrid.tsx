"use client";

/**
 * 1–10 as a 5x2 grid of large tap targets. Deliberately not a range slider:
 * sliders are imprecise on touch and produce noisier data.
 */
export function ScaleGrid({
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  value: number | null;
  onChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-pressed={selected}
              aria-label={`${n} out of 10`}
              className={`notch-sm display flex aspect-square min-h-14 items-center justify-center border text-2xl transition-colors ${
                selected
                  ? "border-gold bg-gold text-ink"
                  : "border-bone/20 bg-bone/5 text-bone hover:border-bone/45 hover:bg-bone/10"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="ticker mt-3 flex justify-between text-[10px] text-bone/50">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
