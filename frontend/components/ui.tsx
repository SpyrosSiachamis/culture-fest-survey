/**
 * Festival UI primitives.
 *
 * Visual language is taken from the event poster: a violet→magenta→orange→gold gradient field,
 * heavy condensed caps for headlines, smoked-glass panels over the gradient so body copy stays
 * readable, and circular stamp badges for small callouts. The gradient, panel, stamp and display
 * treatments live in `app/globals.css` as `.fest-*` classes.
 *
 * Mobile-first throughout: controls are 56px tall (comfortably over the 44px touch minimum), body
 * copy is never below 16px, and nothing exceeds the viewport at 375px.
 */

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "fest-display flex h-14 w-full items-center justify-center gap-2.5 rounded-full px-6 text-xl tracking-wide transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";

  const variants = {
    // Gold on ink — the poster's brightest band, used for the one action that matters per screen.
    primary:
      "bg-fest-gold text-fest-ink shadow-[0_10px_30px_-10px_rgba(255,194,26,0.9)] hover:brightness-110",
    secondary:
      "border-2 border-white/45 bg-white/5 text-white hover:border-white/80 hover:bg-white/10",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-5 w-5 animate-spin rounded-full border-[3px] border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
  hint?: string;
};

export function Input({ label, error, hint, id, className = "", ...props }: InputProps) {
  const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, "-");
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex w-full flex-col gap-2">
      <label
        htmlFor={inputId}
        className="fest-display text-sm tracking-[0.14em] text-fest-gold"
      >
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        /* text-base keeps iOS Safari from auto-zooming the page on focus. */
        className={`h-14 w-full rounded-2xl border-2 bg-black/30 px-4 text-base text-white outline-none transition-colors placeholder:text-white/35 focus:border-fest-gold focus:bg-black/45 disabled:opacity-50 ${
          error ? "border-red-400/80" : "border-white/25"
        } ${className}`}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm font-medium text-red-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-white/60">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type AlertProps = {
  tone: "error" | "success" | "info" | "warning";
  children: ReactNode;
};

export function Alert({ tone, children }: AlertProps) {
  const tones = {
    error: "border-red-400/50 bg-red-500/20 text-red-50",
    success: "border-fest-gold/60 bg-fest-gold/20 text-white",
    info: "border-white/25 bg-white/10 text-white/90",
    warning: "border-orange-300/60 bg-orange-500/25 text-orange-50",
  };

  return (
    <div
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      className={`w-full rounded-2xl border-2 px-4 py-3.5 text-base leading-relaxed ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

/**
 * Circular stamp badge — the poster's "16TH ANNUAL" / "FREE" device.
 * Used for step counters and short status callouts.
 */
export function Stamp({
  top,
  value,
  bottom,
  tone = "light",
}: {
  top?: string;
  value: ReactNode;
  bottom?: string;
  tone?: "light" | "gold";
}) {
  const palette =
    tone === "gold"
      ? "bg-fest-gold text-fest-ink border-fest-ink/25"
      : "bg-white/10 text-white";

  return (
    <div
      className={`fest-stamp fest-display flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full text-center ${palette}`}
    >
      {top && <span className="text-[8px] tracking-[0.18em] opacity-80">{top}</span>}
      <span className="text-2xl leading-none">{value}</span>
      {bottom && <span className="text-[8px] tracking-[0.18em] opacity-80">{bottom}</span>}
    </div>
  );
}

/**
 * Large tappable answer card for single-choice survey questions.
 * Full width and 72px tall, so it clears the 44px touch minimum with room to spare.
 */
export function OptionCard({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex min-h-[4.5rem] w-full flex-col items-start justify-center gap-1 rounded-2xl border-2 px-5 py-3 text-left transition-all duration-150 active:scale-[0.99] ${
        selected
          ? "border-fest-gold bg-fest-gold/20 shadow-[0_0_0_3px_rgba(255,194,26,0.25)]"
          : "border-white/25 bg-black/25 hover:border-white/50 hover:bg-black/35"
      }`}
    >
      <span
        className={`fest-display text-2xl ${selected ? "text-fest-gold" : "text-white"}`}
      >
        {label}
      </span>
      {description && (
        <span className="text-sm leading-snug text-white/65">{description}</span>
      )}
    </button>
  );
}

/**
 * 1–10 rating as a grid of big tappable numbers.
 * A native range slider is far too fiddly on a phone, so this uses 5 columns of 56px targets.
 */
export function ScaleGrid({
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  value: number | null;
  onChange: (value: number) => void;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-5 gap-2.5">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => {
          const selected = value === score;
          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              aria-pressed={selected}
              aria-label={`${score} out of 10`}
              className={`fest-display flex h-14 items-center justify-center rounded-xl border-2 text-2xl transition-all duration-150 active:scale-95 ${
                selected
                  ? "border-fest-gold bg-fest-gold text-fest-ink"
                  : "border-white/25 bg-black/25 text-white hover:border-white/55"
              }`}
            >
              {score}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-white/60">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

/** Multi-select chips. Each chip is its own toggle, so nothing needs a modifier key. */
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
    <div className="flex flex-wrap gap-2.5">
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            aria-pressed={active}
            className={`fest-display flex min-h-12 items-center rounded-full border-2 px-5 text-lg transition-all duration-150 active:scale-95 ${
              active
                ? "border-fest-gold bg-fest-gold text-fest-ink"
                : "border-white/25 bg-black/25 text-white hover:border-white/55"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Free-text answer. Only used for the two optional long-form questions. */
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
  placeholder: string;
  maxLength: number;
}) {
  const id = "survey-text";
  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={id} className="fest-display text-sm tracking-[0.14em] text-fest-gold">
        {label}
      </label>
      <textarea
        id={id}
        rows={4}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-none rounded-2xl border-2 border-white/25 bg-black/30 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-white/35 focus:border-fest-gold focus:bg-black/45"
      />
      <p className="text-right text-xs text-white/50">
        {value.length} / {maxLength}
      </p>
    </div>
  );
}

/** Slim progress bar for the wizard, sitting under the headline. */
export function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-black/35"
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`Question ${current} of ${total}`}
    >
      <div
        className="h-full rounded-full bg-fest-gold transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * Full-bleed festival screen: gradient field, a headline set in display caps, and a glass panel
 * holding the interactive content.
 */
export function FestivalShell({
  eyebrow,
  title,
  description,
  stamp,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  stamp?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="fest-surface flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <main className="flex w-full max-w-md flex-col gap-6">
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            {eyebrow && (
              <p className="fest-display text-xs tracking-[0.28em] text-white/75">{eyebrow}</p>
            )}
            <h1 className="fest-display text-[2.75rem] text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.25)] sm:text-5xl">
              {title}
            </h1>
          </div>
          {stamp}
        </header>

        {description && (
          <p className="text-base leading-relaxed text-white/85">{description}</p>
        )}

        <div className="fest-panel rounded-3xl p-5 sm:p-6">{children}</div>

        {footer}
      </main>
    </div>
  );
}
