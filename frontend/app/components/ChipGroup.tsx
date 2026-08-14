"use client";

/** Multi-select chips. Each chip is a 44px-tall toggle, wrapping freely at 375px. */
export function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isOn = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            aria-pressed={isOn}
            className={`notch-xs ticker min-h-11 px-4 text-[11px] transition-colors ${
              isOn
                ? "bg-gold text-ink"
                : "border border-bone/20 bg-bone/5 text-bone hover:border-bone/45"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
