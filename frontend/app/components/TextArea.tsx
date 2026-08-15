"use client";

/** Free-text answer. 16px base size keeps iOS Safari from zooming the viewport on focus. */
export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label htmlFor="answer" className="ticker block text-[10px] text-bone/60">
        {label}
      </label>
      <textarea
        id="answer"
        rows={5}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="notch-sm mt-2 w-full resize-none border border-bone/20 bg-bone/5 p-3 text-base text-bone outline-none transition-colors placeholder:text-bone/35 focus:border-gold"
      />
      {maxLength && (
        <p className="mt-1.5 text-right text-xs text-bone/40">
          {value.length} / {maxLength}
        </p>
      )}
    </div>
  );
}
