/**
 * Account facts, set like the entries on a printed pass: a micro-caps label, a hairline rule, and
 * the value in display type. Same vocabulary as the survey's field labels, one line per fact so it
 * reads on a phone without any horizontal squeeze.
 */
export function DetailRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  /** Rendered after the value — a pill, usually. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-bone/12 py-3 last:border-b-0">
      <span className="ticker shrink-0 text-[10px] text-bone/50">{label}</span>
      <span className="flex min-w-0 items-center justify-end gap-2 text-right">
        {value && <span className="truncate text-sm text-bone/90">{value}</span>}
        {children}
      </span>
    </div>
  );
}

const PILL_TONES = {
  /** Something is done and good: verified, submitted. */
  good: "border-gold/70 bg-gold/15 text-gold",
  /** Something is outstanding, without being an error. */
  pending: "border-bone/30 bg-bone/10 text-bone/70",
  /** Spent, used up, closed off. */
  spent: "border-magenta/60 bg-magenta/15 text-bone",
} as const;

/** Notched status chip. Small, but it is what people scan the page for. */
export function StatusPill({
  tone = "pending",
  children,
}: {
  tone?: keyof typeof PILL_TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`notch-xs ticker shrink-0 border px-2.5 py-1 text-[9px] whitespace-nowrap ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  );
}
