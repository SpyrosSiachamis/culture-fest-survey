export function Field({
  id,
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="ticker block text-[10px] text-bone/60">
        {label}
      </label>
      <input id={id} className="fest-input mt-1" {...props} />
      {hint && <p className="mt-1.5 text-xs text-bone/45">{hint}</p>}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="notch-sm border border-orange/60 bg-orange/15 px-4 py-3 text-sm text-bone"
    >
      {message}
    </p>
  );
}
