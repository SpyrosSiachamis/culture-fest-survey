const BACKEND_PORT = 5000;

/**
 * Where the browser sends API calls.
 *
 * If NEXT_PUBLIC_API_URL is set it wins (that's the production path). Otherwise
 * we derive it from whatever host the page was loaded from, so the same build
 * works on localhost, a tailnet IP and a MagicDNS name without an env edit —
 * hardcoding one host silently breaks the others.
 *
 * Each origin the frontend is served from still has to appear in the backend's
 * ALLOWED_ORIGINS for CORS.
 */
function apiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window === "undefined") return `http://localhost:${BACKEND_PORT}`;
  return `${window.location.protocol}//${window.location.hostname}:${BACKEND_PORT}`;
}

/** Keys under `errors.*` in the locale files. */
export type ErrorCode =
  | "duplicate"
  | "invalid_credentials"
  | "rate_limit"
  | "network"
  | "generic";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    /** Raw server detail — for logs, never rendered to respondents. */
    public detail?: string,
  ) {
    super(detail ?? code);
    this.name = "ApiError";
  }
}

type FastApiDetail =
  | string
  | { msg?: string; loc?: (string | number)[] }[]
  | undefined;

function readDetail(detail: FastApiDetail): string | undefined {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) return detail[0]?.msg;
  return undefined;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const { method = "GET", body, token } = options;

  let res: Response;
  try {
    res = await fetch(`${apiUrl()}${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network-level failure — also what a CORS rejection looks like from JS.
    throw new ApiError(0, "network");
  }

  if (!res.ok) {
    let detail: FastApiDetail;
    try {
      detail = (await res.json())?.detail;
    } catch {
      detail = undefined;
    }
    const code: ErrorCode =
      res.status === 409
        ? "duplicate"
        : res.status === 401
          ? "invalid_credentials"
          : res.status === 429
            ? "rate_limit"
            : "generic";
    throw new ApiError(res.status, code, readDetail(detail));
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type Account = {
  id: string;
  has_voted: boolean;
  created_at: string;
};

export function signup(input: {
  email: string;
  phone: string;
  password: string;
}): Promise<Account> {
  return request<Account>("/accounts/signup", { method: "POST", body: input });
}

/**
 * A 401 here maps to one single message regardless of cause — the backend
 * deliberately does not distinguish "no such account" from "wrong password",
 * and neither does the UI.
 */
export async function login(input: {
  email: string;
  password: string;
}): Promise<string> {
  const token = await request<{ access_token: string; token_type: string }>(
    "/accounts/login",
    { method: "POST", body: input },
  );
  return token.access_token;
}

export function hasVoted(token: string): Promise<boolean> {
  return request<boolean>("/accounts/me/has-voted", { token });
}

export function submitSurvey(
  token: string,
  payload: Record<string, unknown>,
): Promise<{ message: string }> {
  return request<{ message: string }>("/surveys/submit", {
    method: "POST",
    body: payload,
    token,
  });
}
