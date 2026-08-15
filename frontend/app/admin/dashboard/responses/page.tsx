"use client";

/**
 * Responses — what people actually answered, sliceable.
 *
 * Every chart on this page is generated from the catalogue rather than written out: the page maps
 * over `breakdown.distributions`, picks a shape by `kind`, and labels the categories from the
 * survey's own locale entries. Add a question to the survey model and it appears here, charted and
 * filterable, with no edit to this file.
 *
 * The table at the bottom is not a fallback for the charts, it is the point of them being here: a
 * bar shows you which answer won, and then somebody always needs the actual number to put in a
 * document. Zero-count options are kept in both — an option nobody picked is a result.
 */

import { useEffect, useMemo, useState } from "react";

import { useLang } from "@/components/LanguageProvider";
import {
  AdminNotFound,
  fetchBreakdown,
  type Breakdown,
  type Distribution,
  type FilterSelection,
} from "@/lib/adminApi";
import { fieldLabel, valueLabel } from "@/lib/adminLabels";
import { format, type Dictionary } from "@/lib/i18n";
import { useAdminSchema } from "../../components/AdminProvider";
import {
  AdmButton,
  AdmNotice,
  EmptyState,
  Panel,
  PanelHeading,
  SegmentedControl,
  Skeleton,
} from "../../components/AdminUI";
import { BarChart, ScaleChart, type BarDatum } from "../../components/Charts";
import { FilterBar } from "../../components/FilterBar";
import { formatNumber } from "../../components/format";

/** The window control here also offers "all", which the breakdown endpoint takes as no window. */
const ALL = "all";

/** Given its own panel: the lineup question is the one the festival is actually being planned on. */
const FEATURED_FIELD = "genre_preferences";

export default function ResponsesPage() {
  const { t, lang } = useLang();
  const schema = useAdminSchema();

  const [window, setWindow] = useState<string>(ALL);
  const [filters, setFilters] = useState<FilterSelection>({});
  const [attempt, setAttempt] = useState(0);

  const filterableFields = useMemo(
    () => schema.fields.filter((field) => field.filterable),
    [schema]
  );

  // One string identifying the query currently being asked for. Results and errors are tagged with
  // it, so "is this data current?" is a comparison rather than a piece of state that has to be kept
  // in step with the effect.
  const requestKey = useMemo(
    () => JSON.stringify([window, Object.entries(filters).sort(), attempt]),
    [window, filters, attempt]
  );

  const [result, setResult] = useState<{ key: string; breakdown: Breakdown } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  const loading = result?.key !== requestKey && error?.key !== requestKey;

  useEffect(() => {
    let cancelled = false;

    fetchBreakdown(window === ALL ? null : window, filters)
      .then((breakdown) => {
        if (cancelled) return;
        setResult({ key: requestKey, breakdown });
        setError(null);
      })
      .catch((caught) => {
        if (cancelled) return;
        if (caught instanceof AdminNotFound) globalThis.location.reload();
        else setError({ key: requestKey, message: t.admin.loadError });
      });

    return () => {
      cancelled = true;
    };
    // `requestKey` already encodes window, filters and the retry counter; listing them again would
    // re-run the effect on a new-but-equal filter object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, t]);

  const breakdown = result?.breakdown ?? null;

  const featured = breakdown?.distributions.find((entry) => entry.field === FEATURED_FIELD);
  const others = breakdown?.distributions.filter((entry) => entry.field !== FEATURED_FIELD) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-adm-text">{t.admin.responses.heading}</h1>
          <p className="mt-1 text-sm text-adm-muted">{t.admin.responses.intro}</p>
        </div>

        <SegmentedControl
          label={t.admin.windowLabel}
          value={window}
          onChange={setWindow}
          options={[
            ...schema.windows.map((option) => ({
              value: option,
              label: t.admin.windows[option as keyof typeof t.admin.windows] ?? option,
            })),
            { value: ALL, label: t.admin.windows.all },
          ]}
        />
      </header>

      <FilterBar fields={filterableFields} selection={filters} onChange={setFilters} />

      {error && (
        <AdmNotice tone="error">
          <span className="mr-3">{error.message}</span>
          <AdmButton
            type="button"
            variant="ghost"
            onClick={() => {
              setError(null);
              setAttempt((current) => current + 1);
            }}
          >
            {t.admin.retry}
          </AdmButton>
        </AdmNotice>
      )}

      {breakdown && (
        <p className="text-sm text-adm-muted">
          {format(t.admin.responses.matched, {
            matched: formatNumber(breakdown.matched, lang),
            total: formatNumber(breakdown.total, lang),
          })}
        </p>
      )}

      {loading && !breakdown ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : breakdown && breakdown.matched === 0 ? (
        <EmptyState>{t.admin.responses.empty}</EmptyState>
      ) : (
        breakdown && (
          <>
            {featured && (
              <Panel>
                <PanelHeading
                  title={fieldLabel(t, featured.field)}
                  hint={t.admin.responses.multiHint}
                />
                <BarChart
                  data={toBarData(t, featured, { sort: "count" })}
                  total={featured.respondents}
                  emptyLabel={t.admin.noData}
                />
              </Panel>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              {others.map((distribution) => (
                <Panel key={distribution.field}>
                  <PanelHeading
                    title={fieldLabel(t, distribution.field)}
                    hint={
                      distribution.unanswered > 0
                        ? format(t.admin.responses.skipped, {
                            count: formatNumber(distribution.unanswered, lang),
                          })
                        : undefined
                    }
                  />
                  {distribution.kind === "scale" ? (
                    <ScaleChart
                      data={toBarData(t, distribution)}
                      average={distribution.average}
                      averageLabel={t.admin.responses.average}
                      emptyLabel={t.admin.noData}
                    />
                  ) : (
                    <BarChart
                      data={toBarData(t, distribution)}
                      total={distribution.respondents}
                      emptyLabel={t.admin.noData}
                    />
                  )}
                </Panel>
              ))}
            </div>

            <ValuesTable breakdown={breakdown} />
          </>
        )
      )}
    </div>
  );
}

/**
 * Turn a distribution into chart rows.
 *
 * Declared order is kept by default because most of these questions are ordinal — price bands, age
 * bands, start times — and sorting them by popularity would destroy the only axis they have. The
 * multi-select is the exception: nobody reads the genre list looking for "trap", they read it
 * looking for the top three.
 */
function toBarData(
  t: Dictionary,
  distribution: Distribution,
  options: { sort?: "declared" | "count" } = {}
): BarDatum[] {
  const rows = distribution.buckets.map((bucket) => ({
    key: bucket.value,
    label:
      distribution.kind === "scale"
        ? bucket.value
        : valueLabel(t, distribution.field, bucket.value),
    count: bucket.count,
  }));

  return options.sort === "count" ? [...rows].sort((a, b) => b.count - a.count) : rows;
}

/**
 * Every number on the page, in one place.
 *
 * Deliberately plain and complete rather than a summary — this is the part somebody copies into a
 * budget or a pitch, and a chart cannot be copied.
 */
function ValuesTable({ breakdown }: { breakdown: Breakdown }) {
  const { t, lang } = useLang();

  return (
    <Panel>
      <PanelHeading title={t.admin.values.title} hint={t.admin.values.hint} />

      <div className="adm-scroll -mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-adm-line text-left text-xs uppercase tracking-[0.12em] text-adm-muted">
              <th scope="col" className="py-2 pr-4 font-normal">
                {t.admin.values.question}
              </th>
              <th scope="col" className="py-2 pr-4 font-normal">
                {t.admin.values.answer}
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-normal">
                {t.admin.values.count}
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                {t.admin.values.share}
              </th>
            </tr>
          </thead>
          <tbody>
            {breakdown.distributions.flatMap((distribution) => {
              const rows = distribution.buckets.map((bucket, index) => (
                <tr key={`${distribution.field}-${bucket.value}`} className="border-b border-adm-line/60">
                  <td className="py-2 pr-4 text-adm-muted">
                    {/* Named once per group: repeating it on every row turns the table into noise. */}
                    {index === 0 ? fieldLabel(t, distribution.field) : ""}
                  </td>
                  <td className="py-2 pr-4 text-adm-text">
                    {distribution.kind === "scale"
                      ? bucket.value
                      : valueLabel(t, distribution.field, bucket.value)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-adm-text">
                    {formatNumber(bucket.count, lang)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-adm-muted">
                    {distribution.respondents > 0
                      ? `${((bucket.count / distribution.respondents) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                </tr>
              ));

              if (distribution.unanswered > 0) {
                rows.push(
                  <tr key={`${distribution.field}-unanswered`} className="border-b border-adm-line/60">
                    <td className="py-2 pr-4" />
                    <td className="py-2 pr-4 text-adm-muted italic">{t.admin.values.unanswered}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-adm-muted">
                      {formatNumber(distribution.unanswered, lang)}
                    </td>
                    <td className="py-2 text-right text-adm-muted">—</td>
                  </tr>
                );
              }

              return rows;
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
