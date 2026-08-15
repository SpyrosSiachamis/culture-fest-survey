"use client";

/**
 * Charts, drawn by hand.
 *
 * No charting library. The dashboard needs exactly two shapes — a two-line time series and a bar —
 * and both are a few dozen lines of SVG and flexbox. A library would be a large dependency, would
 * arrive with its own colour system to fight, and would still have to be told how to render in five
 * greys.
 *
 * With no colour to separate the two lines, the time series distinguishes them by weight and dash:
 * accounts solid in the light grey, surveys dashed in the mid grey, with a legend. The same reason
 * every chart here is paired with its real numbers — read off the axis or read off the table, both
 * work.
 */

import { useEffect, useRef, useState } from "react";

/**
 * The rendered width of an element.
 *
 * Charts are measured rather than scaled with `viewBox` + `preserveAspectRatio`, because scaling an
 * SVG scales its type too: on a phone a chart squeezed to a third of its design width would render
 * its axis labels at four pixels. Measuring keeps text at a real size at every width.
 */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

const TEXT = "#e0e0e0";
const MUTED = "#b0b0b0";
const LINE = "#444444";

export type SeriesDatum = {
  /** Bucket start, used for the tooltip and the axis. */
  at: Date;
  primary: number;
  secondary: number;
};

/**
 * Two cumulative lines over time.
 *
 * Both series share one scale on purpose: surveys are a subset of accounts, so the gap between the
 * lines is the thing worth seeing, and a second axis would flatten it into a meaningless
 * coincidence of two shapes.
 */
export function TimeSeriesChart({
  data,
  primaryLabel,
  secondaryLabel,
  formatTick,
  formatTooltip,
  emptyLabel,
}: {
  data: SeriesDatum[];
  primaryLabel: string;
  secondaryLabel: string;
  formatTick: (at: Date) => string;
  formatTooltip: (at: Date) => string;
  emptyLabel: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const height = 240;
  const padding = { top: 16, right: 12, bottom: 28, left: 40 };

  const plotWidth = Math.max(width - padding.left - padding.right, 1);
  const plotHeight = height - padding.top - padding.bottom;

  // Round the ceiling up to something a human would choose, so the gridline labels are whole
  // numbers rather than 7.333.
  const peak = Math.max(1, ...data.map((point) => Math.max(point.primary, point.secondary)));
  const ceiling = niceCeiling(peak);

  const x = (index: number) =>
    padding.left + (data.length <= 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const y = (value: number) => padding.top + plotHeight - (value / ceiling) * plotHeight;

  const path = (pick: (point: SeriesDatum) => number) =>
    data.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(pick(point))}`).join(" ");

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  // Enough room for a label every ~64px, so ticks thin out on a phone instead of overlapping.
  const tickStep = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(width / 64))));

  const active = hover === null ? null : data[hover];

  return (
    <div ref={ref} className="relative w-full">
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-adm-muted">
        <span className="inline-flex items-center gap-2">
          <svg width="18" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="18" y2="4" stroke={TEXT} strokeWidth="2" />
          </svg>
          {primaryLabel}
        </span>
        <span className="inline-flex items-center gap-2">
          <svg width="18" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="18" y2="4" stroke={MUTED} strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          {secondaryLabel}
        </span>
      </div>

      {width > 0 && data.length > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${primaryLabel} and ${secondaryLabel} over time. ${primaryLabel} ends at ${
            data[data.length - 1].primary
          }, ${secondaryLabel} at ${data[data.length - 1].secondary}.`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const offset = event.clientX - bounds.left - padding.left;
            const ratio = plotWidth === 0 ? 0 : offset / plotWidth;
            const index = Math.round(ratio * (data.length - 1));
            setHover(Math.min(data.length - 1, Math.max(0, index)));
          }}
        >
          {gridLines.map((fraction) => {
            const value = Math.round(ceiling * fraction);
            const lineY = y(value);
            return (
              <g key={fraction}>
                <line
                  x1={padding.left}
                  y1={lineY}
                  x2={width - padding.right}
                  y2={lineY}
                  stroke={LINE}
                  strokeWidth="1"
                />
                <text x={padding.left - 8} y={lineY + 4} textAnchor="end" fontSize="10" fill={MUTED}>
                  {value}
                </text>
              </g>
            );
          })}

          {data.map((point, index) =>
            index % tickStep === 0 ? (
              <text
                key={point.at.toISOString()}
                x={x(index)}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                fill={MUTED}
              >
                {formatTick(point.at)}
              </text>
            ) : null
          )}

          <path d={path((point) => point.primary)} fill="none" stroke={TEXT} strokeWidth="2" />
          <path
            d={path((point) => point.secondary)}
            fill="none"
            stroke={MUTED}
            strokeWidth="2"
            strokeDasharray="4 3"
          />

          {hover !== null && (
            <g>
              <line
                x1={x(hover)}
                y1={padding.top}
                x2={x(hover)}
                y2={padding.top + plotHeight}
                stroke={LINE}
                strokeWidth="1"
              />
              <circle cx={x(hover)} cy={y(data[hover].primary)} r="3.5" fill={TEXT} />
              <circle cx={x(hover)} cy={y(data[hover].secondary)} r="3.5" fill={MUTED} />
            </g>
          )}
        </svg>
      ) : (
        <div className="flex h-[240px] items-center justify-center text-sm text-adm-muted">
          {emptyLabel}
        </div>
      )}

      {active && (
        <div
          className="pointer-events-none absolute top-8 rounded-sm border border-adm-line bg-adm-bg px-3 py-2 text-xs text-adm-text shadow-lg"
          // Clamped so the tooltip never leaves the panel at either end of the chart.
          style={{ left: Math.min(Math.max(x(hover ?? 0) - 60, 0), Math.max(width - 130, 0)) }}
        >
          <p className="text-adm-muted">{formatTooltip(active.at)}</p>
          <p className="mt-1 tabular-nums">
            {primaryLabel}: {active.primary}
          </p>
          <p className="tabular-nums">
            {secondaryLabel}: {active.secondary}
          </p>
        </div>
      )}
    </div>
  );
}

/** 7 -> 10, 23 -> 25, 260 -> 300: a round number at or above the peak. */
function niceCeiling(peak: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= peak) return candidate;
  }
  return 10 * magnitude;
}

export type BarDatum = {
  key: string;
  label: string;
  count: number;
};

/**
 * A horizontal bar chart.
 *
 * Horizontal rather than vertical because the categories are worded — "Greek pop", "23:00 or
 * later" — and a column chart would have to rotate or truncate every one of them on a phone. The
 * count and share sit on the row, so the chart is readable as a table when the bars are all short.
 */
export function BarChart({
  data,
  total,
  emptyLabel,
  maxOverride,
}: {
  data: BarDatum[];
  /** Denominator for the percentages. Usually the number of respondents, not the sum of counts. */
  total: number;
  emptyLabel: string;
  /** Force the bar scale, e.g. to compare two charts side by side. */
  maxOverride?: number;
}) {
  if (data.length === 0) {
    return <p className="py-4 text-sm text-adm-muted">{emptyLabel}</p>;
  }

  const max = maxOverride ?? Math.max(1, ...data.map((entry) => entry.count));

  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((entry) => {
        const share = total > 0 ? (entry.count / total) * 100 : 0;
        return (
          <li key={entry.key}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate text-adm-text">{entry.label}</span>
              <span className="shrink-0 tabular-nums text-adm-muted">
                {entry.count}
                <span className="ml-2 text-adm-muted/70">{share.toFixed(0)}%</span>
              </span>
            </div>
            <div className="mt-1 h-2 w-full rounded-[1px] bg-adm-text/[0.06]">
              <div
                className="h-full rounded-[1px] bg-adm-accent transition-[width] duration-300"
                style={{ width: `${(entry.count / max) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A 1-10 scale, as a row of columns.
 *
 * The one place columns beat bars: the labels are single digits, the order is the whole point, and
 * the shape of the distribution is what is being read rather than any individual value.
 */
export function ScaleChart({
  data,
  average,
  averageLabel,
  emptyLabel,
}: {
  data: BarDatum[];
  average: number | null;
  averageLabel: string;
  emptyLabel: string;
}) {
  const max = Math.max(1, ...data.map((entry) => entry.count));
  const answered = data.reduce((sum, entry) => sum + entry.count, 0);

  if (answered === 0) {
    return <p className="py-4 text-sm text-adm-muted">{emptyLabel}</p>;
  }

  return (
    <div>
      <div className="flex h-32 items-end gap-1.5">
        {data.map((entry) => (
          <div key={entry.key} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] tabular-nums text-adm-muted">
              {entry.count || ""}
            </span>
            <div
              className="w-full rounded-[1px] bg-adm-accent transition-[height] duration-300"
              style={{ height: `${Math.max((entry.count / max) * 100, entry.count > 0 ? 4 : 1)}%` }}
              title={`${entry.label}: ${entry.count}`}
            />
            <span className="text-[10px] tabular-nums text-adm-muted">{entry.label}</span>
          </div>
        ))}
      </div>
      {average !== null && (
        <p className="mt-3 text-xs text-adm-muted">
          {averageLabel} <span className="tabular-nums text-adm-text">{average.toFixed(2)}</span>
        </p>
      )}
    </div>
  );
}
