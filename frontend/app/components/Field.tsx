"use client";

import { useState } from "react";

import { useLang } from "@/components/LanguageProvider";

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

/**
 * Password entry with a reveal toggle.
 *
 * Worth having on a phone: the whole point of a masked field is that nobody can read it, including
 * the person typing, and a password typed blind on a soft keyboard is the most common way to get
 * locked out of an account that was created correctly. Revealing is the user's own call, taken one
 * field at a time, and nothing remembers it — the state is local, so it is masked again on the next
 * render of a fresh form.
 *
 * "Show"/"Hide" in words rather than an eye icon: nothing else in this design uses icons, and the
 * label reads the same to a screen reader as it does on screen.
 */
export function PasswordField({
  id,
  label,
  hint,
  error,
  className = "",
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
    <div>
      <label htmlFor={id} className="ticker block text-[10px] text-bone/60">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={revealed ? "text" : "password"}
          // While revealed the field is plain text as far as the phone is concerned, and iOS will
          // capitalise the first letter and autocorrect the rest of it. Off on both types, so
          // toggling never changes what actually gets typed.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          // Room for the toggle, sized for the longest label in either language.
          className={`fest-input mt-1 pr-20 ${className}`}
          {...props}
        />

        {/* type="button" so it cannot submit the form it sits inside. */}
        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          aria-controls={id}
          aria-pressed={revealed}
          aria-label={revealed ? t.common.hidePassword : t.common.showPassword}
          className="ticker absolute right-0 bottom-0 flex h-12 cursor-pointer items-center whitespace-nowrap px-2 text-[10px] text-bone/50 transition-colors hover:text-gold"
        >
          {revealed ? t.common.hide : t.common.show}
        </button>
      </div>

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
