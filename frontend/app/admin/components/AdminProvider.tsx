"use client";

/**
 * Loads the two things every dashboard page needs, once: who the admin is, and the analytics
 * catalogue that describes the survey's questions.
 *
 * The catalogue is fetched rather than imported. It is derived on the backend from the same
 * pydantic model that validates submissions, so fetching it is what keeps the dashboard's filters
 * and charts in step with what the survey actually accepts — a copy of the option lists in the
 * frontend would be a second source of truth, and the one that goes stale.
 *
 * The `notFound` state is the server's masked refusal. It covers "not an admin", "not signed in"
 * and "session expired" without distinguishing them, because the API does not distinguish them
 * either, and the frontend inventing a more specific message would undo the masking.
 */

import { createContext, useContext, useEffect, useState } from "react";

import {
  AdminNotFound,
  fetchAdminSession,
  fetchAnalyticsSchema,
  type AdminSession,
  type AnalyticsSchema,
} from "@/lib/adminApi";

type AdminState = "loading" | "ready" | "notFound" | "error";

type AdminContextValue = {
  state: AdminState;
  session: AdminSession | null;
  schema: AnalyticsSchema | null;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminState>("loading");
  const [session, setSession] = useState<AdminSession | null>(null);
  const [schema, setSchema] = useState<AnalyticsSchema | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchAdminSession(), fetchAnalyticsSchema()])
      .then(([nextSession, nextSchema]) => {
        if (cancelled) return;
        setSession(nextSession);
        setSchema(nextSchema);
        setState("ready");
      })
      .catch((caught) => {
        if (cancelled) return;
        setState(caught instanceof AdminNotFound ? "notFound" : "error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminContext.Provider value={{ state, session, schema }}>{children}</AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextValue {
  const context = useContext(AdminContext);
  if (!context) throw new Error("useAdmin must be used inside AdminProvider");
  return context;
}

/**
 * The catalogue, for a page that only renders once the shell has it.
 *
 * The shell does not render its children until `state` is "ready", so by the time a page runs, both
 * of these are populated — this just saves every page a null check the shell has already done.
 */
export function useAdminSchema(): AnalyticsSchema {
  const { schema } = useAdmin();
  if (!schema) throw new Error("Admin schema read before the shell finished loading");
  return schema;
}
