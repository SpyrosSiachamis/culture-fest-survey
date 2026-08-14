import { Fragment } from "react";

/** Poster-style "MUSIC * FILMS * PANELS" run, with gold separators. */
export function Ticker({
  words,
  className = "",
}: {
  words: string[];
  className?: string;
}) {
  return (
    <p className={`ticker ${className}`}>
      {words.map((w, i) => (
        <Fragment key={w}>
          {i > 0 && <span className="text-gold"> * </span>}
          {w}
        </Fragment>
      ))}
    </p>
  );
}
