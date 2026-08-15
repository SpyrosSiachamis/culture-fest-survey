/**
 * The handful of glyphs the dashboard needs, inline.
 *
 * These carry the whole meaning of the aside when it is collapsed, so they are drawn on a shared
 * 24-grid with a consistent stroke and each one is paired with a tooltip and an accessible name at
 * the call site — an icon-only rail is only usable if the icon is not the only label.
 */

type IconProps = { className?: string };

function Svg({ className = "size-5", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Overview: a trend line over an axis. */
export function TrendIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 4v15a1 1 0 0 0 1 1h15" />
      <path d="M7 15l4-5 3 3 4-6" />
    </Svg>
  );
}

/** Responses: stacked bars. */
export function BarsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h11" />
      <path d="M4 12h16" />
      <path d="M4 17h7" />
    </Svg>
  );
}

/** Admins: a shield. */
export function ShieldIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l7 3v5c0 4.4-2.9 8.3-7 9.5C7.9 19.3 5 15.4 5 11V6z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </Svg>
  );
}

/** The aside toggle: a panel with its rail highlighted. */
export function PanelIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </Svg>
  );
}

/** Lookup: a magnifier. */
export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Svg>
  );
}

export function SignOutIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 8l-4 4 4 4" />
      <path d="M6 12h9" />
    </Svg>
  );
}
