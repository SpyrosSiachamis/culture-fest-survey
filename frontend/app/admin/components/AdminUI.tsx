"use client";

/**
 * The dashboard's building blocks.
 *
 * Five colours, no more: charcoal ground, light grey type, mid grey for secondary text, dark grey
 * for every rule and edge, soft grey for accents. There is no brand colour and no status green or
 * red — a number that matters is made to matter by size and placement, not by hue, which is also
 * why none of this depends on colour vision to read.
 *
 * Surfaces are the text colour at 3% rather than a lighter grey, so a panel on a panel stays inside
 * the palette instead of inventing a sixth value.
 */

import { useState } from "react";

import { useLang } from "@/components/LanguageProvider";

export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`adm-panel rounded-sm p-5 ${className}`}>{children}</section>;
}

export function PanelHeading({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-wide text-adm-text">{title}</h2>
        {hint && <p className="mt-1 text-xs leading-relaxed text-adm-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/** One headline number. `sub` carries the context that stops a bare figure being meaningless. */
export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="adm-panel rounded-sm px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-adm-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-adm-text">{value}</p>
      {sub && <p className="mt-1 text-xs text-adm-muted">{sub}</p>}
    </div>
  );
}

export function AdmButton({
  children,
  variant = "solid",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "solid" | "ghost" }) {
  const base =
    "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-sm px-4 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const look =
    variant === "solid"
      ? "border border-adm-accent bg-adm-accent/20 text-adm-text hover:bg-adm-accent/30"
      : "border border-adm-line text-adm-muted hover:border-adm-accent hover:text-adm-text";

  return (
    <button {...props} className={`${base} ${look} ${className}`}>
      {children}
    </button>
  );
}

/** A segmented control. Used for the time windows, where the options are few and mutually exclusive. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-sm border border-adm-line p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`min-h-8 cursor-pointer rounded-[2px] px-3 text-xs transition-colors ${
              active
                ? "bg-adm-accent/25 text-adm-text"
                : "text-adm-muted hover:text-adm-text"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// Shared so the plain and the password field cannot drift apart. 16px type so iOS Safari does not
// zoom the viewport when the field takes focus.
const ADM_INPUT =
  "min-h-11 w-full rounded-sm border border-adm-line bg-transparent px-3 text-base text-adm-text outline-none transition-colors placeholder:text-adm-muted/60 focus:border-adm-accent disabled:opacity-50";

function FieldFrame({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-adm-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          className="mt-1.5 text-xs text-adm-text underline decoration-adm-accent underline-offset-4"
        >
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-adm-muted">{hint}</p>
      )}
    </div>
  );
}

export function AdmField({
  id,
  label,
  hint,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
}) {
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-1.5 ${ADM_INPUT}`}
        {...props}
      />
    </FieldFrame>
  );
}

/** Password entry with a reveal toggle. See `PasswordField` in app/components/Field.tsx. */
export function AdmPasswordField({
  id,
  label,
  hint,
  error,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
}) {
  const { t } = useLang();
  const [revealed, setRevealed] = useState(false);

  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={revealed ? "text" : "password"}
          // Revealed, this is a plain text field to the OS keyboard, which would otherwise
          // capitalise and autocorrect it. Off on both types, so the toggle cannot change what is
          // actually typed.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${ADM_INPUT} pr-20`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          aria-controls={id}
          aria-pressed={revealed}
          aria-label={revealed ? t.common.hidePassword : t.common.showPassword}
          className="absolute inset-y-0 right-0 flex cursor-pointer items-center whitespace-nowrap px-3 text-xs text-adm-muted transition-colors hover:text-adm-text"
        >
          {revealed ? t.common.hide : t.common.show}
        </button>
      </div>
    </FieldFrame>
  );
}

/**
 * Inline message. With no colour to lean on, the left rule and the `role` do the work: errors and
 * warnings announce themselves, everything else is a quiet status.
 */
export function AdmNotice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-sm border-l-2 bg-adm-text/[0.03] px-4 py-3 text-sm leading-relaxed text-adm-text ${
        tone === "error" ? "border-adm-text" : "border-adm-accent"
      }`}
    >
      {children}
    </p>
  );
}

/** Loading placeholder shaped like the thing it stands in for. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-sm bg-adm-text/[0.06] ${className}`} />;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-sm border border-dashed border-adm-line px-4 py-8 text-center text-sm text-adm-muted">
      {children}
    </p>
  );
}
