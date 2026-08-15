"use client";

/**
 * The dashboard chrome: the aside, and the three states that can stand in for a page.
 *
 * The aside behaves as two different things depending on the room available. Above `lg` it is a
 * permanent rail that collapses to icons and expands to icons-with-names, and the choice is
 * remembered. Below `lg` there is no room for a permanent rail at all, so it becomes a drawer over
 * the content, always expanded while open — a collapsed icon rail on a phone would eat a fifth of
 * the width to say nothing.
 *
 * Nothing here is a security boundary. The 404 below is rendered because the API already refused;
 * hiding the route in the client would not stop anyone from calling the API directly, which is why
 * every admin endpoint runs its own check.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";

import { logout } from "@/lib/api";
import { useLang } from "@/components/LanguageProvider";
import { NotFoundScreen } from "@/app/components/NotFoundScreen";
import { AdmButton, Skeleton } from "./AdminUI";
import { useAdmin } from "./AdminProvider";
import {
  BarsIcon,
  CloseIcon,
  PanelIcon,
  SearchIcon,
  ShieldIcon,
  SignOutIcon,
  TrendIcon,
} from "./Icons";

const COLLAPSE_KEY = "cf-admin-aside-collapsed";

/**
 * Whether the rail is collapsed, as an external store.
 *
 * The same shape `LanguageProvider` uses, for the same reason: the value lives in localStorage,
 * which the server cannot read. `useSyncExternalStore` lets the server render the known default
 * while the client reads the real preference, with no hydration mismatch and no setState in an
 * effect to cascade a second render.
 */
const collapseStore = {
  listeners: new Set<() => void>(),

  subscribe(listener: () => void) {
    collapseStore.listeners.add(listener);
    return () => {
      collapseStore.listeners.delete(listener);
    };
  },

  getSnapshot(): boolean {
    return window.localStorage.getItem(COLLAPSE_KEY) === "true";
  },

  getServerSnapshot(): boolean {
    return false;
  },

  set(collapsed: boolean) {
    window.localStorage.setItem(COLLAPSE_KEY, String(collapsed));
    collapseStore.listeners.forEach((listener) => listener());
  },
};

type NavItem = {
  href: string;
  labelKey: "overview" | "responses" | "lookup" | "admins";
  Icon: (props: { className?: string }) => React.ReactElement;
};

const NAV: NavItem[] = [
  { href: "/admin/dashboard", labelKey: "overview", Icon: TrendIcon },
  { href: "/admin/dashboard/responses", labelKey: "responses", Icon: BarsIcon },
  { href: "/admin/dashboard/lookup", labelKey: "lookup", Icon: SearchIcon },
  { href: "/admin/dashboard/admins", labelKey: "admins", Icon: ShieldIcon },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { t } = useLang();
  const { state, session } = useAdmin();
  const pathname = usePathname();
  const router = useRouter();

  const collapsed = useSyncExternalStore(
    collapseStore.subscribe,
    collapseStore.getSnapshot,
    collapseStore.getServerSnapshot
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const toggleCollapsed = useCallback(() => collapseStore.set(!collapsed), [collapsed]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      // Server-side first: the session cookie has to actually be cleared, not just navigated away
      // from. Then out to the ordinary Culture Fest sign-in — admins have no login page of their own.
      await logout();
    } finally {
      router.push("/");
    }
  }, [router]);

  if (state === "loading") {
    return (
      <div className="min-h-dvh bg-adm-bg p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // What the API said, repeated verbatim — and repeated as the *same screen* a mistyped URL gets,
  // rather than a dashboard-flavoured one. A 404 that looked like it came from the dashboard would
  // confirm there is a dashboard, which is the one thing the API's masking is trying not to do.
  if (state === "notFound") {
    return <NotFoundScreen />;
  }

  if (state === "error") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-adm-bg px-6 text-center">
        <p className="text-sm text-adm-muted">{t.admin.loadError}</p>
        <AdmButton type="button" onClick={() => window.location.reload()}>
          {t.admin.retry}
        </AdmButton>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh bg-adm-bg text-adm-text">
      {/* Scrim. Only ever present on small screens, where the aside floats over the content. */}
      {drawerOpen && (
        <button
          type="button"
          aria-label={t.admin.closeMenu}
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
        />
      )}

      <aside
        className={`adm-aside fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-adm-line bg-adm-bg lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-[4.75rem]" : "lg:w-60"}`}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-adm-line px-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? t.admin.expandMenu : t.admin.collapseMenu}
            title={collapsed ? t.admin.expandMenu : t.admin.collapseMenu}
            className="hidden size-10 cursor-pointer items-center justify-center rounded-sm text-adm-muted transition-colors hover:bg-adm-text/[0.06] hover:text-adm-text lg:flex"
          >
            <PanelIcon />
          </button>

          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label={t.admin.closeMenu}
            className="flex size-10 cursor-pointer items-center justify-center rounded-sm text-adm-muted transition-colors hover:text-adm-text lg:hidden"
          >
            <CloseIcon />
          </button>

          <span
            className={`adm-aside-label truncate text-sm font-semibold ${
              collapsed ? "lg:pointer-events-none lg:w-0 lg:opacity-0" : "opacity-100"
            }`}
          >
            {t.admin.title}
          </span>
        </div>

        <nav className="adm-scroll flex-1 overflow-y-auto p-2" aria-label={t.admin.title}>
          <ul className="flex flex-col gap-1">
            {NAV.map(({ href, labelKey, Icon }) => {
              // Exact match on the index route only, so /responses does not light up Overview too.
              const active = href === "/admin/dashboard" ? pathname === href : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    // Closed here rather than on a route change, so the drawer never lingers over
                    // the page it was used to reach.
                    onClick={() => setDrawerOpen(false)}
                    // The title is what makes the collapsed rail usable — the icon alone is a guess.
                    title={t.admin.nav[labelKey]}
                    className={`flex min-h-11 items-center gap-3 rounded-sm px-3 text-sm transition-colors ${
                      active
                        ? "bg-adm-text/[0.08] text-adm-text"
                        : "text-adm-muted hover:bg-adm-text/[0.04] hover:text-adm-text"
                    }`}
                  >
                    <Icon className="size-5 shrink-0" />
                    <span
                      className={`adm-aside-label truncate ${
                        collapsed ? "lg:w-0 lg:opacity-0" : "opacity-100"
                      }`}
                    >
                      {t.admin.nav[labelKey]}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Accounts hold no name and no readable email — only one-way hashes — so the role and a
            short reference are genuinely all there is to identify the person signed in. */}
        <div className="shrink-0 border-t border-adm-line p-2">
          <div
            className={`flex min-h-11 items-center gap-3 rounded-sm px-3 ${
              collapsed ? "lg:justify-center lg:px-0" : ""
            }`}
            title={`${t.admin.role}: ${session?.role ?? ""}`}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-adm-accent text-[10px] uppercase text-adm-muted">
              {(session?.role ?? "?").slice(0, 2)}
            </span>
            <span
              className={`adm-aside-label min-w-0 ${collapsed ? "lg:w-0 lg:opacity-0" : "opacity-100"}`}
            >
              <span className="block truncate text-xs uppercase tracking-[0.14em] text-adm-text">
                {session?.role}
              </span>
              <span className="block truncate text-[11px] text-adm-muted">
                {session?.reference}
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            title={t.admin.signOut}
            className={`mt-1 flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-sm px-3 text-sm text-adm-muted transition-colors hover:bg-adm-text/[0.04] hover:text-adm-text disabled:opacity-50 ${
              collapsed ? "lg:justify-center lg:px-0" : ""
            }`}
          >
            <SignOutIcon className="size-5 shrink-0" />
            <span
              className={`adm-aside-label truncate ${collapsed ? "lg:w-0 lg:opacity-0" : "opacity-100"}`}
            >
              {signingOut ? t.admin.signingOut : t.admin.signOut}
            </span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-adm-line bg-adm-bg px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t.admin.openMenu}
            className="flex size-10 cursor-pointer items-center justify-center rounded-sm text-adm-muted transition-colors hover:text-adm-text"
          >
            <PanelIcon />
          </button>
          <span className="truncate text-sm font-semibold">{t.admin.title}</span>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
