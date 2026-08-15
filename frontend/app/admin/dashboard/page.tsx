"use client";

/**
 * Overview — how big the platform is and how fast it is growing.
 *
 * The one graph on this page plots both cumulative lines against a shared scale, because the
 * question it exists to answer is not "how many accounts" or "how many surveys" separately but how
 * far apart they are: every account above the surveys line is somebody who signed up and never
 * answered. The participation figure underneath is the same fact as a number.
 *
 * "Surveys" is counted from submitted responses, never from accounts. An account that exists is not
 * a survey, and the gap between `voted_accounts` and `surveys` is shown rather than smoothed over.
 */

import { useEffect, useState } from "react";

import { useLang } from "@/components/LanguageProvider";
import { AdminNotFound, fetchOverview, type Overview } from "@/lib/adminApi";
import { format } from "@/lib/i18n";
import { useAdminSchema } from "../components/AdminProvider";
import { AdmButton, AdmNotice, Panel, PanelHeading, SegmentedControl, Skeleton, StatCard } from "../components/AdminUI";
import { TimeSeriesChart } from "../components/Charts";
import {
  dateTimeFormatter,
  formatNumber,
  formatPercent,
  parseStamp,
  tickFormatter,
} from "../components/format";

export default function OverviewPage() {
  const { t, lang } = useLang();
  const schema = useAdminSchema();

  const [window, setWindow] = useState(schema.default_window);
  // Results and errors are tagged with the window they belong to, which is what lets "loading" be
  // derived rather than stored. Storing it would mean a setState in the effect body, and the extra
  // render it causes is exactly what the React compiler's lint rule is pointing at.
  const [result, setResult] = useState<{ window: string; overview: Overview } | null>(null);
  const [error, setError] = useState<{ window: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  const loading = result?.window !== window && error?.window !== window;

  useEffect(() => {
    let cancelled = false;

    fetchOverview(window)
      .then((overview) => {
        if (cancelled) return;
        setResult({ window, overview });
        setError(null);
      })
      .catch((caught) => {
        if (cancelled) return;
        // A 404 mid-session means the session went away. Reloading lands on the same masked 404 the
        // shell renders, which is the honest outcome.
        if (caught instanceof AdminNotFound) globalThis.location.reload();
        else setError({ window, message: t.admin.loadError });
      });

    return () => {
      cancelled = true;
    };
  }, [window, attempt, t]);

  // The last data that actually arrived, kept on screen while the next window loads rather than
  // blanking the page. Formatted against *its* window, not the one being requested.
  const overview = result?.overview ?? null;
  const shownWindow = result?.window ?? window;
  const totals = overview?.totals;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-adm-text">{t.admin.overview.heading}</h1>
          <p className="mt-1 text-sm text-adm-muted">{t.admin.overview.intro}</p>
        </div>

        <SegmentedControl
          label={t.admin.windowLabel}
          value={window}
          onChange={setWindow}
          options={schema.windows.map((option) => ({
            value: option,
            label: t.admin.windows[option as keyof typeof t.admin.windows] ?? option,
          }))}
        />
      </header>

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

      <Panel>
        <PanelHeading
          title={t.admin.overview.graphTitle}
          hint={format(t.admin.overview.graphHint, {
            window: t.admin.windows[shownWindow as keyof typeof t.admin.windows] ?? shownWindow,
          })}
        />

        {loading && !overview ? (
          <Skeleton className="h-64 w-full" />
        ) : overview ? (
          <TimeSeriesChart
            data={overview.series.map((point) => ({
              at: parseStamp(point.start),
              primary: point.accounts_cumulative,
              secondary: point.surveys_cumulative,
            }))}
            primaryLabel={t.admin.metrics.accounts}
            secondaryLabel={t.admin.metrics.surveys}
            formatTick={tickFormatter(shownWindow, lang)}
            formatTooltip={dateTimeFormatter(lang)}
            emptyLabel={t.admin.noData}
          />
        ) : null}

        {overview && (
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-adm-line pt-4 text-sm">
            <div>
              <dt className="text-xs text-adm-muted">{t.admin.overview.newAccounts}</dt>
              <dd className="mt-1 text-lg tabular-nums text-adm-text">
                +{formatNumber(overview.accounts_in_window, lang)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-adm-muted">{t.admin.overview.newSurveys}</dt>
              <dd className="mt-1 text-lg tabular-nums text-adm-text">
                +{formatNumber(overview.surveys_in_window, lang)}
              </dd>
            </div>
          </dl>
        )}
      </Panel>

      {totals ? (
        <>
          <Panel>
            <PanelHeading
              title={t.admin.overview.participationTitle}
              hint={t.admin.overview.participationHint}
            />
            <p className="text-4xl font-semibold tabular-nums text-adm-text">
              {formatPercent(totals.voted_percentage, lang)}
            </p>
            <p className="mt-2 text-sm text-adm-muted">
              {format(t.admin.overview.participationOf, {
                voted: formatNumber(totals.voted_accounts, lang),
                accounts: formatNumber(totals.accounts, lang),
              })}
            </p>
            {/* The same number as a bar. Reading a percentage off a figure takes a beat; reading it
                off a length does not. */}
            <div
              className="mt-4 h-3 w-full rounded-[1px] bg-adm-text/[0.06]"
              role="img"
              aria-label={format(t.admin.overview.participationOf, {
                voted: String(totals.voted_accounts),
                accounts: String(totals.accounts),
              })}
            >
              <div
                className="h-full rounded-[1px] bg-adm-accent transition-[width] duration-500"
                style={{ width: `${Math.min(totals.voted_percentage, 100)}%` }}
              />
            </div>
          </Panel>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-adm-text">{t.admin.overview.totals}</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <StatCard
                label={t.admin.metrics.accounts}
                value={formatNumber(totals.accounts, lang)}
                sub={t.admin.overview.accountsSub}
              />
              <StatCard
                label={t.admin.metrics.surveys}
                value={formatNumber(totals.surveys, lang)}
                sub={t.admin.overview.surveysSub}
              />
              <StatCard
                label={t.admin.metrics.verified}
                value={formatNumber(totals.verified_accounts, lang)}
                sub={t.admin.overview.verifiedSub}
              />
              <StatCard
                label={t.admin.metrics.voted}
                value={formatNumber(totals.voted_accounts, lang)}
                sub={t.admin.overview.votedSub}
              />
              <StatCard
                label={t.admin.metrics.redeemed}
                value={formatNumber(totals.redeemed, lang)}
                sub={t.admin.overview.redeemedSub}
              />
              <StatCard
                label={t.admin.metrics.admins}
                value={formatNumber(totals.admin_accounts, lang)}
                sub={t.admin.overview.adminsSub}
              />
            </div>
          </section>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      )}
    </div>
  );
}
