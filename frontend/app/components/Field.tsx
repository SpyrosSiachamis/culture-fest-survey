export function Field({
  id,
  label,
  hint,
  error,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="ticker block text-[10px] text-bone/60">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`fest-input mt-1 ${className}`}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-orange">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-bone/45">{hint}</p>
      )}
    </div>
  );
}

const TONES = {
  error: "border-orange/60 bg-orange/15",
  warning: "border-gold/60 bg-gold/10",
  info: "border-bone/30 bg-bone/8",
  success: "border-gold/70 bg-gold/15",
} as const;

/** Notched inline message. `error` and `warning` announce themselves to screen readers. */
export function Notice({
  tone = "error",
  children,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      className={`notch-sm border px-4 py-3 text-sm text-bone ${TONES[tone]}`}
    >
      {children}
    </p>
  );
}
