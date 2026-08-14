/**
 * Notched glass panel. The gradient sits on the outer element and the inner
 * element is inset by 1px, so the notched edge keeps a real gradient hairline
 * (a plain CSS border would be sliced off by the clip-path).
 */
export function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`notch bg-linear-to-br from-gold/70 via-magenta/50 to-violet/60 p-px ${className}`}
    >
      <div className="notch glass h-full w-full p-6 sm:p-8">{children}</div>
    </div>
  );
}
