"use client";

/**
 * Admins — who else can see this, and how to add another.
 *
 * There is nothing identifying to list. Accounts store a peppered hash of the email and phone and
 * nothing else, so an admin is a reference, a join date and whether the address has been confirmed.
 * That is a deliberate property of the system, not a gap in this page.
 *
 * Creating one posts to an endpoint only an admin can reach; the new account's role is set
 * server-side and no request anywhere can ask for a role, so there is no self-promotion to guard
 * against here beyond being on this page at all. The new admin then verifies their email like
 * everyone else before they can sign in — the account is real but inert until they do.
 */

import { useEffect, useState } from "react";

import { useLang } from "@/components/LanguageProvider";
import {
  AdminNotFound,
  AdminRequestError,
  createAdminAccount,
  fetchAdminAccounts,
  promoteAccountToAdmin,
  type AdminAccount,
} from "@/lib/adminApi";
import { format } from "@/lib/i18n";
import { makeValidators } from "@/lib/validation";
import { useAdmin } from "../../components/AdminProvider";
import {
  AdmButton,
  AdmField,
  AdmNotice,
  AdmPasswordField,
  EmptyState,
  Panel,
  PanelHeading,
  Skeleton,
} from "../../components/AdminUI";
import { formatDate } from "../../components/format";

export default function AdminsPage() {
  const { t, lang } = useLang();
  const { session } = useAdmin();
  const v = makeValidators(t);

  const [admins, setAdmins] = useState<AdminAccount[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    phone?: string;
    password?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  // Bumped after a successful creation, to re-read the list.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchAdminAccounts()
      .then((next) => {
        if (cancelled) return;
        setAdmins(next);
        setListError(null);
      })
      .catch((caught) => {
        if (cancelled) return;
        if (caught instanceof AdminNotFound) globalThis.location.reload();
        else setListError(t.admin.loadError);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, t]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    // Same validators the public signup uses, so the two forms agree on what a valid address,
    // phone and password are. The server revalidates all of it regardless.
    const errors = {
      email: v.email(email) ?? undefined,
      phone: v.phone(phone) ?? undefined,
      password: v.password(password) ?? undefined,
    };
    setFieldErrors(errors);
    if (errors.email || errors.phone || errors.password) return;

    setSubmitting(true);
    setResult(null);

    try {
      const created = await createAdminAccount({
        email: email.trim(),
        phone: phone.trim(),
        password,
      });
      setResult({ tone: "success", message: created.message });
      setEmail("");
      setPhone("");
      setPassword("");
      setAttempt((current) => current + 1);
    } catch (caught) {
      if (caught instanceof AdminNotFound) {
        globalThis.location.reload();
        return;
      }
      setResult({
        tone: "error",
        message:
          caught instanceof AdminRequestError ? caught.message : t.admin.admins.createFailed,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-adm-text">{t.admin.admins.heading}</h1>
        <p className="mt-1 text-sm text-adm-muted">{t.admin.admins.intro}</p>
      </header>

      <Panel>
        <PanelHeading title={t.admin.admins.youTitle} />
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-adm-muted">{t.admin.role}</dt>
            <dd className="mt-1 uppercase tracking-[0.12em] text-adm-text">{session?.role}</dd>
          </div>
          <div>
            <dt className="text-xs text-adm-muted">{t.admin.admins.reference}</dt>
            <dd className="mt-1 tabular-nums text-adm-text">{session?.reference}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-adm-muted">{t.admin.admins.privacy}</p>
      </Panel>

      <Panel>
        <PanelHeading title={t.admin.admins.listTitle} hint={t.admin.admins.listHint} />

        {listError ? (
          <AdmNotice tone="error">{listError}</AdmNotice>
        ) : admins === null ? (
          <Skeleton className="h-24 w-full" />
        ) : admins.length === 0 ? (
          <EmptyState>{t.admin.admins.listEmpty}</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-adm-line">
            {admins.map((admin) => (
              <li
                key={admin.reference}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
              >
                <span className="tabular-nums text-adm-text">
                  {admin.reference}
                  {admin.is_self && (
                    <span className="ml-2 text-xs text-adm-muted">{t.admin.admins.you}</span>
                  )}
                </span>
                <span className="text-xs text-adm-muted">
                  {format(t.admin.admins.since, { date: formatDate(admin.created_at, lang) })}
                  {" · "}
                  {admin.email_verified
                    ? t.admin.admins.verified
                    : t.admin.admins.awaitingVerification}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <PromotePanel onPromoted={() => setAttempt((current) => current + 1)} />

      <Panel>
        <PanelHeading title={t.admin.admins.createTitle} hint={t.admin.admins.createHint} />

        <form onSubmit={handleCreate} noValidate className="flex flex-col gap-4">
          {result && <AdmNotice tone={result.tone}>{result.message}</AdmNotice>}

          <AdmField
            id="admin-email"
            label={t.signup.email}
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder={t.signup.emailPlaceholder}
            value={email}
            error={fieldErrors.email}
            disabled={submitting}
            onChange={(event) => setEmail(event.target.value)}
          />

          <AdmField
            id="admin-phone"
            label={t.signup.phone}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder={t.signup.phonePlaceholder}
            value={phone}
            error={fieldErrors.phone}
            disabled={submitting}
            onChange={(event) => setPhone(event.target.value)}
          />

          <AdmPasswordField
            id="admin-password"
            label={t.signup.password}
            autoComplete="new-password"
            value={password}
            error={fieldErrors.password}
            hint={format(t.signup.passwordHint, { min: 8 })}
            disabled={submitting}
            onChange={(event) => setPassword(event.target.value)}
          />

          <div>
            <AdmButton type="submit" disabled={submitting}>
              {submitting ? t.admin.admins.creating : t.admin.admins.create}
            </AdmButton>
          </div>
        </form>
      </Panel>
    </div>
  );
}

/**
 * Promote an account that already exists.
 *
 * Kept as its own component with its own state, not a second mode of the create form, because they
 * are different acts: creating touches nothing that exists, promoting hands the dashboard to
 * somebody else's account. Sharing a field would make it possible to fill in one form and submit
 * the other.
 *
 * The address is the only handle there is. Nothing readable is stored, so the server matches it by
 * hashing it the same way signup did, and answers with the account's short reference — which is the
 * one piece of confirmation available that the right account was hit. Anyone unsure should check it
 * against the list above.
 */
function PromotePanel({ onPromoted }: { onPromoted: () => void }) {
  const { t } = useLang();
  const v = makeValidators(t);

  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  async function handlePromote(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const error = v.email(email) ?? undefined;
    setFieldError(error);
    if (error) return;

    setSubmitting(true);
    setResult(null);

    try {
      const promoted = await promoteAccountToAdmin(email.trim());
      setResult({ tone: "success", message: promoted.message });
      setEmail("");
      onPromoted();
    } catch (caught) {
      if (caught instanceof AdminNotFound) {
        globalThis.location.reload();
        return;
      }
      // "No such account" and "not verified yet" arrive as a 422 with a usable sentence, so the
      // server's own message is shown rather than a generic failure. A 404 would have meant the
      // session went, which is handled above — not here.
      setResult({
        tone: "error",
        message:
          caught instanceof AdminRequestError ? caught.message : t.admin.admins.promoteFailed,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel>
      <PanelHeading title={t.admin.admins.promoteTitle} hint={t.admin.admins.promoteHint} />

      <form onSubmit={handlePromote} noValidate className="flex flex-col gap-4">
        {result && <AdmNotice tone={result.tone}>{result.message}</AdmNotice>}

        <AdmField
          id="promote-email"
          label={t.admin.admins.promoteEmail}
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder={t.signup.emailPlaceholder}
          value={email}
          error={fieldError}
          hint={t.admin.admins.promoteEmailHint}
          disabled={submitting}
          onChange={(event) => setEmail(event.target.value)}
        />

        <div>
          <AdmButton type="submit" disabled={submitting}>
            {submitting ? t.admin.admins.promoting : t.admin.admins.promote}
          </AdmButton>
        </div>
      </form>
    </Panel>
  );
}
