/**
 * Circular stamp, borrowed from the festival-poster vocabulary
 * ("16TH ANNUAL", "100% FREE"). Used for step counts and hero callouts.
 */
export function StampBadge({
  top,
  main,
  bottom,
  tone = "light",
  className = "",
}: {
  top?: string;
  main: string;
  bottom?: string;
  tone?: "light" | "dark" | "gold";
  className?: string;
}) {
  const tones = {
    light: "border-bone/70 text-bone",
    dark: "border-ink/70 text-ink",
    gold: "border-gold text-gold",
  } as const;

  return (
    <div
      className={`relative flex size-20 shrink-0 flex-col items-center justify-center rounded-full border-2 ${tones[tone]} ${className}`}
      aria-hidden="true"
    >
      <span className="absolute inset-1.5 rounded-full border border-current opacity-45" />
      {top && (
        <span className="ticker text-[7px] leading-none opacity-85">{top}</span>
      )}
      <span className="display mt-0.5 text-[17px] leading-none">{main}</span>
      {bottom && (
        <span className="ticker mt-1 text-[7px] leading-none opacity-85">
          {bottom}
        </span>
      )}
    </div>
  );
}
