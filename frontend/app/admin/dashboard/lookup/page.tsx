"use client";

/**
 * Account lookup — the manual fallback for the door.
 *
 * When the QR scanner cannot tell staff whether a pass is genuine or already spent, a visitor reads
 * out the reference from their profile and this page answers the only questions that matter at the
 * door: has this account voted, is it verified, and — the point of it — has it already redeemed, and
 * when. Nothing here is linked to survey answers; the responses carry no account id, so this cannot
 * deanonymise anyone.
 *
 * A short reference prefix can match a lot of accounts, so the result is a list, capped server-side
 * with a "there were more" flag rather than an unbounded dump.
 */

import { useState } from "react";

import { useLang } from "@/components/LanguageProvider";
import {
  AdminNotFound,
  AdminRequestError,
  lookupAccounts,
  type AccountLookup,
  type AccountLookupResults,
} from "@/lib/adminApi";
import { format } from "@/lib/i18n";
import {
  AdmButton,
  AdmField,
  AdmNotice,
  EmptyState,
  Panel,
  PanelHeading,
  Skeleton,
} from "../../components/AdminUI";
import { formatDateTime } from "../../components/format";

export default function LookupPage() {
  const { t, lang } = useLang();

  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AccountLookupResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const query = term.trim();
    if (!query || loading) return;

    setLoading(true);
    setSubmitted(true);
    setError(null);

    try {
      setResults(await lookupAccounts(query));
    } catch (caught) {
      setResults(null);
      if (caught instanceof AdminNotFound) {
        globalThis.location.reload();
        return;
      }
      // A too-short or malformed reference comes back as a 422 with a usable sentence.
      setError(caught instanceof AdminRequestError ? caught.message : t.admin.loadError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-adm-text">{t.admin.lookup.heading}</h1>
        <p className="mt-1 text-sm text-adm-muted">{t.admin.lookup.intro}</p>
      </header>

      <Panel>
        <PanelHeading title={t.admin.lookup.searchTitle} hint={t.admin.lookup.searchHint} />
        <form onSubmit={handleSearch} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <AdmField
              id="lookup-reference"
              label={t.admin.lookup.referenceLabel}
              value={term}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={t.admin.lookup.referencePlaceholder}
              onChange={(event) => setTerm(event.target.value)}
            />
          </div>
          <AdmButton type="submit" disabled={loading || term.trim().length === 0}>
            {loading ? t.admin.lookup.searching : t.admin.lookup.search}
          </AdmButton>
        </form>
      </Panel>

      {error && <AdmNotice tone="error">{error}</AdmNotice>}

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : results ? (
        <Results data={results} lang={lang} />
      ) : (
        submitted &&
        !error && <EmptyState>{t.admin.lookup.empty}</EmptyState>
      )}
    </div>
  );
}

function Results({ data, lang }: { data: AccountLookupResults; lang: "en" | "el" }) {
  const { t } = useLang();

  if (data.count === 0) {
    return <EmptyState>{format(t.admin.lookup.noMatch, { query: data.query })}</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-adm-muted">
        {format(t.admin.lookup.matchCount, { count: String(data.count), query: data.query })}
        {data.truncated && ` ${format(t.admin.lookup.truncated, { limit: String(data.count) })}`}
      </p>

      <ul className="flex flex-col gap-3">
        {data.results.map((account) => (
          <AccountCard key={account.account_id} account={account} lang={lang} />
        ))}
      </ul>
    </div>
  );
}

function AccountCard({ account, lang }: { account: AccountLookup; lang: "en" | "el" }) {
  const { t } = useLang();

  return (
    <li className="adm-panel rounded-sm p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-mono text-base tabular-nums text-adm-text">{account.reference}</span>
        <span className="font-mono text-xs text-adm-muted">{account.account_id}</span>
      </div>

      {/* Redemption is the headline — it is why this page exists. It gets its own row and, when
          spent, the timestamp of when. */}
      <div className="mt-4 rounded-sm border border-adm-line p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs uppercase tracking-[0.12em] text-adm-muted">
            {t.admin.lookup.redeemed}
          </span>
          <StatusTag on={account.has_redeemed} yes={t.admin.lookup.yes} no={t.admin.lookup.no} />
        </div>
        {account.has_redeemed && (
          <p className="mt-2 text-sm text-adm-text">
            {account.redeemed_at
              ? format(t.admin.lookup.redeemedWhen, {
                  when: formatDateTime(account.redeemed_at, lang),
                })
              : t.admin.lookup.redeemedNoTime}
          </p>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <StatusRow
          label={t.admin.lookup.voted}
          on={account.has_voted}
          yes={t.admin.lookup.yes}
          no={t.admin.lookup.no}
        />
        <StatusRow
          label={t.admin.lookup.verified}
          on={account.email_verified}
          yes={t.admin.lookup.yes}
          no={t.admin.lookup.no}
        />
        <div className="col-span-2 flex items-center justify-between border-t border-adm-line/60 pt-2">
          <dt className="text-xs uppercase tracking-[0.12em] text-adm-muted">
            {t.admin.lookup.created}
          </dt>
          <dd className="tabular-nums text-adm-muted">{formatDateTime(account.created_at, lang)}</dd>
        </div>
      </dl>
    </li>
  );
}

function StatusRow({
  label,
  on,
  yes,
  no,
}: {
  label: string;
  on: boolean;
  yes: string;
  no: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-xs uppercase tracking-[0.12em] text-adm-muted">{label}</dt>
      <dd>
        <StatusTag on={on} yes={yes} no={no} />
      </dd>
    </div>
  );
}

/**
 * A yes/no tag. With no colour in the palette to carry the meaning, the state is spelled out in the
 * word and reinforced by a filled vs hollow dot, so it reads without relying on hue.
 */
function StatusTag({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-adm-text">
      <span
        aria-hidden="true"
        className={`inline-block size-2 rounded-full ${
          on ? "bg-adm-text" : "border border-adm-accent"
        }`}
      />
      {on ? yes : no}
    </span>
  );
}
