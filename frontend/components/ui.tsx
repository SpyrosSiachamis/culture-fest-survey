/**
 * Minimal form primitives.
 *
 * Styling follows what is already in `app/page.tsx`: h-12 controls, rounded-full buttons, the
 * `foreground`/`background` theme tokens, opacity-suffixed borders and zinc greys. Mobile-first —
 * controls are full width and only constrained at the `sm:` breakpoint upwards.
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
    "flex h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-base font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

  const variants = {
    primary: "bg-foreground text-background hover:bg-[#383838] dark:hover:bg-[#ccc]",
    secondary:
      "border border-solid border-black/[.08] hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]",
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
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
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
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-12 w-full rounded-2xl border border-solid bg-transparent px-4 text-base outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 disabled:opacity-50 dark:placeholder:text-zinc-600 dark:focus:border-zinc-400 ${
          error
            ? "border-red-500/60 dark:border-red-500/60"
            : "border-black/[.12] dark:border-white/[.145]"
        } ${className}`}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-zinc-500 dark:text-zinc-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type AlertProps = {
  tone: "error" | "success" | "info";
  children: ReactNode;
};

export function Alert({ tone, children }: AlertProps) {
  const tones = {
    error:
      "border-red-500/30 bg-red-500/[.06] text-red-700 dark:text-red-300",
    success:
      "border-green-600/30 bg-green-600/[.06] text-green-800 dark:text-green-300",
    info: "border-black/[.08] bg-black/[.04] text-zinc-700 dark:border-white/[.145] dark:bg-white/[.06] dark:text-zinc-300",
  };

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`w-full rounded-2xl border border-solid px-4 py-3 text-sm leading-relaxed ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

export function FormShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-12 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50">
            {title}
          </h1>
          {description && (
            <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
              {description}
            </p>
          )}
        </div>
        {children}
      </main>
    </div>
  );
}
