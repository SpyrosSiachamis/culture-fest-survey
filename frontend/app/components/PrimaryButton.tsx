/** Full-width, thumb-zone action. 56px tall — well clear of the 44px floor. */
export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      // py-3 + min-h lets long labels (Greek runs longer than English) wrap
      // to two lines instead of spilling out of the button.
      className={`notch-sm display flex min-h-14 w-full items-center justify-center gap-2 bg-gold px-6 py-3 text-center text-lg leading-tight text-ink transition-[transform,filter] active:scale-[0.985] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}

/** Quieter companion action ("Back"). Same 44px+ target. */
export function GhostButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`ticker flex min-h-11 items-center justify-center px-4 text-xs text-bone/70 transition-colors hover:text-bone cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}
