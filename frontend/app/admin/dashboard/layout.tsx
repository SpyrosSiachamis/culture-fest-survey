import type { Metadata } from "next";

import { AdminProvider } from "../components/AdminProvider";
import { AdminShell } from "../components/AdminShell";

/**
 * Everything under /admin/dashboard.
 *
 * A server component purely so it can carry metadata — `noindex` keeps the route out of search
 * results, which is worth having but is not what protects it. The protection is that every piece of
 * data on every page below comes from an endpoint that independently checks the caller's role and
 * answers 404 to anyone else.
 */
export const metadata: Metadata = {
  title: "Culture Fest · Admin",
  robots: { index: false, follow: false },
};

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
