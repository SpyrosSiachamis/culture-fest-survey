"use client";

/** Full-width tappable option, ~76px tall. Selected state is a gold fill. */
export function ChoiceCard({
  marker,
  label,
  hint,
  selected,
  onSelect,
}: {
  marker: string;
  label: string;
  hint?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`notch-sm flex w-full items-center gap-4 border px-4 py-4 text-left transition-colors cursor-pointer ${
        selected
          ? "border-gold bg-gold text-ink"
          : "border-bone/20 bg-bone/5 text-bone hover:border-bone/45 hover:bg-bone/10"
      }`}
    >
      <span
        className={`display flex size-11 shrink-0 items-center justify-center rounded-full text-lg ${
          selected ? "bg-ink text-gold" : "bg-bone/12 text-bone/75"
        }`}
      >
        {marker}
      </span>
      <span className="min-w-0">
        <span className="display block text-xl">{label}</span>
        {hint && (
          <span
            className={`block text-sm ${selected ? "text-ink/70" : "text-bone/55"}`}
          >
            {hint}
          </span>
        )}
      </span>
    </button>
  );
}
