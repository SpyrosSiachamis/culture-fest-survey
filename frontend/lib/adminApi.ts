/**
 * Client for the `/admin` API.
 *
 * Separate from `lib/api.ts` only because the shapes are, not because the transport is: these calls
 * carry the same session cookie as every other call, set by the same `/accounts/login`. There is no
 * admin token, no admin header and nothing here that grants access — authorisation is the `role`
 * check the server runs on every one of these endpoints.
 *
 * The API answers **404** to anyone who is not a signed-in admin, deliberately, so that the
 * dashboard's existence is not disclosed. `AdminNotFound` below is that answer, and the pages turn
 * it into Next's own not-found screen. It means "no" without saying what was being refused, and the
 * frontend must not try to be more informative than the server was.
 */

const DEV_API_PORT = "5000";

function apiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured;

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${DEV_API_PORT}`;
  }

  return `http://localhost:${DEV_API_PORT}`;
}

/** The server's masked refusal: not an admin, not signed in, or genuinely no such route. */
export class AdminNotFound extends Error {
  constructor() {
    super("Not found");
    this.name = "AdminNotFound";
  }
}

export class AdminRequestError extends Error {
  readonly httpStatus: number;

  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = "AdminRequestError";
    this.httpStatus = httpStatus;
  }
}

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl()}${path}`, { ...init, credentials: "include" });
  } catch {
    throw new AdminRequestError("Could not reach the server.", 0);
  }

  if (response.status === 404) throw new AdminNotFound();

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = (body as { detail?: unknown } | null)?.detail;
    throw new AdminRequestError(
      typeof detail === "string" ? detail : "Something went wrong.",
      response.status
    );
  }

  return body as T;
}

// --- Shapes, mirroring src/schemas.py ------------------------------------------------------------

export type FieldKind = "single" | "multi" | "bool" | "scale";

export type AnalyticsField = {
  name: string;
  kind: FieldKind;
  /** Every accepted answer, in the order the backend enum declares them. Empty for scales. */
  values: string[];
  optional: boolean;
  filterable: boolean;
  minimum: number | null;
  maximum: number | null;
};

export type AnalyticsSchema = {
  fields: AnalyticsField[];
  windows: string[];
  default_window: string;
};

export type Totals = {
  accounts: number;
  verified_accounts: number;
  voted_accounts: number;
  admin_accounts: number;
  surveys: number;
  redeemed: number;
  voted_percentage: number;
};

export type SeriesPoint = {
  start: string;
  end: string;
  accounts: number;
  surveys: number;
  accounts_cumulative: number;
  surveys_cumulative: number;
};

export type Overview = {
  window: string;
  generated_at: string;
  window_start: string;
  totals: Totals;
  accounts_in_window: number;
  surveys_in_window: number;
  series: SeriesPoint[];
};

export type Bucket = { value: string; count: number };

export type Distribution = {
  field: string;
  kind: FieldKind;
  respondents: number;
  unanswered: number;
  buckets: Bucket[];
  average: number | null;
  minimum: number | null;
  maximum: number | null;
};

export type Breakdown = {
  window: string | null;
  generated_at: string;
  total: number;
  matched: number;
  filters: Record<string, string[]>;
  distributions: Distribution[];
};

export type AdminSession = {
  role: string;
  reference: string;
};

export type AdminAccount = {
  reference: string;
  created_at: string;
  email_verified: boolean;
  is_self: boolean;
};

/** Field name -> selected values. Empty arrays are dropped before the request is built. */
export type FilterSelection = Record<string, string[]>;

// --- Calls ---------------------------------------------------------------------------------------

export function fetchAdminSession(): Promise<AdminSession> {
  return adminRequest<AdminSession>("/admin/session");
}

export function fetchAnalyticsSchema(): Promise<AnalyticsSchema> {
  return adminRequest<AnalyticsSchema>("/admin/analytics/schema");
}

export function fetchOverview(window: string): Promise<Overview> {
  return adminRequest<Overview>(`/admin/analytics/overview?window=${encodeURIComponent(window)}`);
}

/**
 * Distributions for every question, filtered.
 *
 * Filters go up as repeated query parameters named after the survey fields. The server validates
 * both the names and the values against its own catalogue, so a stale selection left over from a
 * removed option is a 422 rather than a chart that silently ignored it.
 */
export function fetchBreakdown(
  window: string | null,
  filters: FilterSelection
): Promise<Breakdown> {
  const params = new URLSearchParams();
  if (window) params.set("window", window);

  for (const [field, values] of Object.entries(filters)) {
    for (const value of values) params.append(field, value);
  }

  const query = params.toString();
  return adminRequest<Breakdown>(`/admin/analytics/breakdown${query ? `?${query}` : ""}`);
}

export function fetchAdminAccounts(): Promise<AdminAccount[]> {
  return adminRequest<AdminAccount[]>("/admin/accounts");
}

export type NewAdminInput = {
  email: string;
  phone: string;
  password: string;
};

export function createAdminAccount(input: NewAdminInput) {
  return adminRequest<{ reference: string; message: string }>("/admin/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
