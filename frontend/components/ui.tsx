"use client";

/**
 * Festival UI primitives.
 *
 * The system's signature is geometric rather than decorative: opposite corners are chamfered on
 * every surface (`.notch-*`), edges are 1px gradient hairlines (`.fest-edge`), callouts are
 * concentric double-ring stamps, and text inputs are underlines rather than boxes. Type is heavy
 * grotesque caps for headings with wide-tracked uppercase micro-labels. Those treatments live in
 * `app/globals.css`.
 *
 * Mobile-first: controls are at least 56px tall, body copy never drops below 16px, and nothing
 * overflows a 375px viewport.
 */

import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

import { LANGUAGES } from "@/lib/i18n";
import { useLang } from "@/components/LanguageProvider";

/* ---------------------------------------------------------------------------- language toggle */

export function LanguageToggle() {
  const { lang, setLang } = useLang();

  return (
    <div className="flex" role="group" aria-label="Language">
      {LANGUAGES.map(({ code, label }) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={active}
            className={`fest-display notch-xs flex h-11 w-16 items-center justify-center text-base transition-colors ${
              active
                ? "bg-fest-gold text-fest-ink"
                : "bg-white/5 text-fest-cream/70 shadow-[inset_0_0_0_1px_rgba(245,239,230,0.3)] hover:text-fest-cream"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------------- surfaces */

/** Chamfered card with a gradient hairline edge. */
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`fest-edge notch-lg ${className}`}>
      <div className="fest-panel notch-lg px-5 py-6 sm:px-7 sm:py-8">{children}</div>
    </div>
  );
}

/** Concentric double-ring stamp — the poster's badge device. */
export function Stamp({
  top,
  value,
  bottom,
  tone = "light",
  size = "md",
}: {
  top?: string;
  value: ReactNode;
  bottom?: string;
  tone?: "light" | "gold";
  size?: "md" | "lg";
}) {
  const dimensions = size === "lg" ? "h-32 w-32" : "h-24 w-24";
  const palette =
    tone === "gold" ? "bg-fest-gold text-fest-ink" : "bg-white/5 text-fest-cream";

  return (
    <div
      className={`fest-stamp flex ${dimensions} shrink-0 flex-col items-center justify-center rounded-full text-center ${palette}`}
    >
      {top && <span className="fest-micro text-[9px] opacity-75">{top}</span>}
      <span className="fest-display text-2xl leading-none">{value}</span>
      {bottom && <span className="fest-micro text-[9px] opacity-75">{bottom}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------------------------ actions */

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
    "fest-display notch-sm flex h-14 w-full items-center justify-center gap-2.5 px-6 text-xl transition-all duration-150 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40";

  const variants = {
    primary: "bg-fest-gold text-fest-ink hover:brightness-110",
    secondary:
      "bg-white/[0.07] text-fest-cream shadow-[inset_0_0_0_2px_rgba(245,239,230,0.28)] hover:bg-white/15",
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

/** Understated text action, used for Back and Skip so they never compete with the primary. */
export function TextAction({
  children,
  onClick,
  arrow,
}: {
  children: ReactNode;
  onClick: () => void;
  arrow?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fest-micro flex min-h-11 w-full items-center justify-center gap-2 text-xs text-fest-cream/65 transition-colors hover:text-fest-cream"
    >
      {arrow && <span aria-hidden="true">←</span>}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------------------------- inputs */

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
  hint?: string;
};

/** Underline-only field: a rule under the value rather than a boxed control. */
export function Input({ label, error, hint, id, className = "", ...props }: InputProps) {
  const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, "-");
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex w-full flex-col gap-1">
      <label htmlFor={inputId} className="fest-micro text-[11px] text-fest-cream/55">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        /* text-base keeps iOS Safari from auto-zooming the page on focus. */
        className={`h-14 w-full border-b-2 bg-transparent text-lg text-fest-cream outline-none transition-colors placeholder:text-fest-cream/25 focus:border-fest-gold disabled:opacity-50 ${
          error ? "border-red-400" : "border-white/25"
        } ${className}`}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="pt-1 text-sm font-medium text-red-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="pt-1 text-sm text-fest-cream/45">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

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
    <div className="flex w-full flex-col gap-1">
      <label htmlFor={id} className="fest-micro text-[11px] text-fest-cream/55">
        {label}
      </label>
      <textarea
        id={id}
        rows={4}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="notch-sm w-full resize-none bg-white/5 px-4 py-3 text-base text-fest-cream outline-none shadow-[inset_0_0_0_1px_rgba(245,239,230,0.25)] transition-colors placeholder:text-fest-cream/25 focus:shadow-[inset_0_0_0_2px_#ffc21a]"
      />
      <p className="pt-1 text-right text-xs text-fest-cream/40">
        {value.length} / {maxLength}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------------------ answers */

/** Lettered answer row (A / B / C), chamfered, with a circular index badge. */
export function OptionCard({
  letter,
  label,
  description,
  selected,
  onSelect,
}: {
  letter: string;
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  // clip-path crops a real border, so the outline is a 1px underlay behind the fill, clipped to
  // the same shape. That keeps the edge unbroken around the chamfered corners.
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`notch-md block w-full p-px text-left transition-all duration-150 active:scale-[0.995] ${
        selected ? "bg-fest-gold" : "bg-white/20 hover:bg-white/40"
      }`}
    >
      <span
        className={`notch-md flex min-h-[4.5rem] w-full items-center gap-4 px-4 py-3 ${
          selected ? "bg-fest-gold/15" : "bg-[#22102b]"
        }`}
      >
        <span
          className={`fest-display flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg ${
            selected ? "bg-fest-gold text-fest-ink" : "bg-white/10 text-fest-cream/80"
          }`}
        >
          {letter}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span
            className={`fest-display text-xl ${selected ? "text-fest-gold" : "text-fest-cream"}`}
          >
            {label}
          </span>
          {description && (
            <span className="text-sm leading-snug text-fest-cream/55">{description}</span>
          )}
        </span>
      </span>
    </button>
  );
}

/** 1–10 rating as chamfered tap targets. A range slider is unusable on a phone. */
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
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => {
          const selected = value === score;
          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              aria-pressed={selected}
              aria-label={`${score} out of 10`}
              className={`notch-xs block h-14 p-px transition-all duration-150 active:scale-95 ${
                selected ? "bg-fest-gold" : "bg-white/20 hover:bg-white/45"
              }`}
            >
              <span
                className={`fest-display notch-xs flex h-full w-full items-center justify-center text-2xl ${
                  selected ? "bg-fest-gold text-fest-ink" : "bg-[#22102b] text-fest-cream"
                }`}
              >
                {score}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex justify-between gap-3">
        <span className="fest-micro text-[10px] text-fest-cream/50">{lowLabel}</span>
        <span className="fest-micro text-[10px] text-fest-cream/50">{highLabel}</span>
      </div>
    </div>
  );
}

/** Multi-select chips. Each is an independent toggle. */
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
        const active = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            aria-pressed={active}
            className={`notch-xs block p-px transition-all duration-150 active:scale-95 ${
              active ? "bg-fest-gold" : "bg-white/20 hover:bg-white/45"
            }`}
          >
            <span
              className={`fest-display notch-xs flex min-h-12 items-center px-4 text-base ${
                active ? "bg-fest-gold text-fest-ink" : "bg-[#22102b] text-fest-cream"
              }`}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------------- feedback */

type AlertProps = {
  tone: "error" | "success" | "info" | "warning";
  children: ReactNode;
};

export function Alert({ tone, children }: AlertProps) {
  const tones = {
    error: "bg-red-500/15 text-red-100 ring-red-400/50",
    success: "bg-fest-gold/15 text-fest-cream ring-fest-gold/60",
    info: "bg-white/[0.06] text-fest-cream/85 ring-white/25",
    warning: "bg-orange-500/20 text-orange-50 ring-orange-300/60",
  };

  return (
    <div
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      className={`notch-sm w-full px-4 py-3.5 text-base leading-relaxed shadow-[inset_0_0_0_1px_currentColor] ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

/** Step stamp, gradient progress rail and its caption. */
export function ProgressHeader({
  stampTop,
  stampValue,
  stampBottom,
  percent,
  caption,
}: {
  stampTop: string;
  stampValue: string;
  stampBottom: string;
  percent: number;
  caption: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <Stamp top={stampTop} value={stampValue} bottom={stampBottom} />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div
          className="h-2 w-full overflow-hidden bg-black/30"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-gradient-to-r from-fest-pink via-fest-orange to-fest-gold transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="fest-micro text-[10px] leading-relaxed text-fest-cream/55">{caption}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------------------- shell */

/**
 * Page frame: the gradient field, the language toggle, an optional progress header, and the
 * chamfered panel holding the content.
 */
export function FestivalShell({
  progress,
  eyebrow,
  title,
  description,
  children,
  footer,
  hero,
}: {
  progress?: ReactNode;
  eyebrow?: string;
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  hero?: ReactNode;
}) {
  return (
    <div className="fest-surface flex flex-1 flex-col items-center px-4 pb-12 pt-5">
      <div className="flex w-full max-w-md flex-col gap-5">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>

        {hero}
        {progress}

        <Panel>
          <div className="flex flex-col gap-5">
            {(eyebrow || title || description) && (
              <div className="flex flex-col gap-3">
                {eyebrow && (
                  <p className="fest-micro text-[11px] text-fest-gold">{eyebrow}</p>
                )}
                {title && (
                  <h1 className="fest-display text-[2.1rem] text-fest-cream sm:text-4xl">
                    {title}
                  </h1>
                )}
                {description && (
                  <p className="text-base leading-relaxed text-fest-cream/65">{description}</p>
                )}
              </div>
            )}
            {children}
          </div>
        </Panel>

        {/* The gradient ends in bright gold, so footer copy gets a dark chip rather than
            relying on whichever band it happens to land on. */}
        {footer && <div className="notch-sm bg-black/45 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Inline link styled to the system. */
export function InlineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="font-semibold text-fest-gold underline underline-offset-4 hover:brightness-110"
    >
      {children}
    </Link>
  );
}
