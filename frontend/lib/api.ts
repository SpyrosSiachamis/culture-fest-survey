/**
 * Thin client for the FastAPI backend.
 *
 * Everything here is a convenience for the UI only. The server revalidates every field and owns
 * every security decision — nothing on this side of the wire is trusted.
 *
 * Every call goes out with `credentials: "include"`, because the session is an HttpOnly cookie
 * that the backend sets at login. This file never sees, stores or attaches a token: the browser
 * re-sends the cookie by itself, which is exactly why a page reload no longer signs the user out.
 * The matching backend requirement is `allow_credentials=True` with the frontend's exact origin
 * listed in ALLOWED_ORIGINS — a wildcard origin makes the browser drop the cookie.
 */

/** Port the backend is published on when the URL has to be derived. Matches BACKEND_PORT. */
const DEV_API_PORT = "5000";

/**
 * Where the API lives, from the browser's point of view.
 *
 * `NEXT_PUBLIC_API_URL` wins when it is set, and must be set in production. With it unset — the
 * documented dev setup in `frontend/.env` — the host is taken from whatever host the page was
 * loaded from, which is what makes testing from a phone over the tailnet work: a hardcoded
 * "localhost" would send the phone to *itself*, and every call, cookie included, would fail.
 *
 * Read lazily rather than at module scope because `window` does not exist during server
 * rendering. Every caller here runs in the browser, from an event handler or an effect.
 */
function apiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured;

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${DEV_API_PORT}`;
  }

  return `http://localhost:${DEV_API_PORT}`;
}

/** Machine-readable states the account endpoints can report back. */
export type VerificationStatus =
  | "verified"
  | "invalid"
  | "expired"
  | "too_many_attempts"
  | "already_verified"
  | "email_not_verified"
  | "already_submitted"
  /** The reset link was forged, tampered with, expired, or already used — one status for all. */
  | "invalid_reset_token"
  | "rate_limited"
  | "network_error"
  /** No usable session: the caller is signed out, or was never signed in. */
  | "unauthenticated";

export type ApiError = {
  status: VerificationStatus | "error";
  message: string;
};

export type SignupInput = {
  email: string;
  phone: string;
  password: string;
};

export type SignupAccepted = {
  message: string;
  expires_in_minutes: number;
};

export type ResendAccepted = {
  message: string;
  cooldown_seconds: number;
};

export type VerificationResult = {
  status: string;
  message: string;
};

/**
 * Matches VERIFICATION_RESEND_COOLDOWN_SECONDS on the server. Used to seed the countdown right
 * after signup; every later value comes from the resend response itself.
 */
export const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;

const GENERIC_ERROR = "Something went wrong. Please try again.";
const NETWORK_ERROR =
  "Could not reach the server. Check your connection and try again.";
const RATE_LIMITED =
  "Too many requests. Please wait a moment before trying again.";
const SIGNED_OUT = "Your session has ended. Sign in again to continue.";

/** FastAPI errors arrive as `detail`, which is a string, an object, or a validation array. */
function readErrorBody(body: unknown, httpStatus: number): ApiError {
  if (httpStatus === 429) {
    // The verification endpoint also uses 429 for "too many attempts", so prefer its own status.
    const detail = (body as { detail?: unknown } | null)?.detail;
    if (detail && typeof detail === "object" && "status" in detail) {
      const typed = detail as { status: VerificationStatus; message?: string };
      return { status: typed.status, message: typed.message ?? RATE_LIMITED };
    }
    return { status: "rate_limited", message: RATE_LIMITED };
  }

  const detail = (body as { detail?: unknown } | null)?.detail;

  // 401/403 without a status of its own means "no usable session" — an expired cookie, or none at
  // all. Endpoints that report something more specific (login's "email_not_verified") answer with
  // a structured detail, which is read further down and wins.
  const isAuthFailure = httpStatus === 401 || httpStatus === 403;
  const hasOwnStatus =
    detail !== null && typeof detail === "object" && !Array.isArray(detail) && "status" in detail;

  if (isAuthFailure && !hasOwnStatus) {
    return {
      status: "unauthenticated",
      message: typeof detail === "string" ? detail : SIGNED_OUT,
    };
  }

  if (typeof detail === "string") {
    return { status: "error", message: detail };
  }

  if (Array.isArray(detail)) {
    // Pydantic validation errors: surface the first message rather than the whole tree.
    const first = detail[0] as { msg?: string } | undefined;
    return {
      status: "error",
      message: first?.msg ? first.msg.replace(/^Value error, /, "") : GENERIC_ERROR,
    };
  }

  if (detail && typeof detail === "object") {
    const typed = detail as { status?: VerificationStatus; message?: string };
    return {
      status: typed.status ?? "error",
      message: typed.message ?? GENERIC_ERROR,
    };
  }

  return { status: "error", message: GENERIC_ERROR };
}

async function request<T>(
  path: string,
  init: RequestInit & { method: string }
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      // Sends the session cookie, and lets the backend set it on the way back.
      credentials: "include",
    });
  } catch {
    throw { status: "network_error", message: NETWORK_ERROR } satisfies ApiError;
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw readErrorBody(body, response.status);
  }

  return body as T;
}

function post<T>(path: string, payload?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

export type LoginInput = {
  email: string;
  password: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export function signup(input: SignupInput) {
  return post<SignupAccepted>("/accounts/signup", input);
}

export function login(input: LoginInput) {
  return post<TokenResponse>("/accounts/login", input);
}

export function verifyEmail(email: string, code: string) {
  return post<VerificationResult>("/accounts/verify-email", { email, code });
}

export function resendVerificationCode(email: string) {
  return post<ResendAccepted>("/accounts/verify-email/resend", { email });
}

/**
 * Mirrors PASSWORD_RESET_TTL_MINUTES on the server. Shown in the "check your email" copy; the
 * server is what actually enforces it.
 */
export const PASSWORD_RESET_TTL_MINUTES = 30;

export type PasswordResetAccepted = { message: string };
export type PasswordResetResult = { message: string };

/**
 * Ask for a reset link.
 *
 * The backend answers 202 with a constant message whether or not the address has an account, and
 * the UI shows its own constant message regardless — so nothing here, including the response body,
 * is ever rendered back to the user. The only failures worth surfacing are the ones that mean the
 * request did not land at all (rate limit, network), which say nothing about the address.
 */
export function requestPasswordReset(email: string) {
  return post<PasswordResetAccepted>("/accounts/password-reset/request", { email });
}

export function confirmPasswordReset(token: string, newPassword: string) {
  return post<PasswordResetResult>("/accounts/password-reset/confirm", {
    token,
    new_password: newPassword,
  });
}

/** The signed-in account, as returned by `/accounts/me`. */
export type RedemptionStatus = "not_eligible" | "ready" | "redeemed";

export type Profile = {
  /** Short quotable account reference. Not the full account id. */
  reference: string;
  email_verified: boolean;
  email_verified_at: string | null;
  has_voted: boolean;
  created_at: string;
  redemption: {
    status: RedemptionStatus;
    /** Present only when `status` is "ready" — this is what the QR encodes. */
    token: string | null;
    redeemed_at: string | null;
  };
};

/**
 * The signed-in account, or `null` if there is no live session.
 *
 * A 401/403 is the ordinary "not signed in" answer, not a failure, so it resolves to null rather
 * than throwing. Anything else — a network drop, a 500 — still throws, because "signed out" and
 * "the server is unreachable" are different things and the UI must not conflate them.
 */
export async function fetchProfile(): Promise<Profile | null> {
  try {
    return await request<Profile>("/accounts/me", { method: "GET" });
  } catch (caught) {
    if (isApiError(caught) && caught.status === "unauthenticated") return null;
    throw caught;
  }
}

/** Ends the session server-side by clearing the cookie it lives in. */
export function logout(): Promise<void> {
  return post<void>("/accounts/logout");
}

/**
 * Submit the completed survey.
 *
 * The session cookie is the only thing identifying the caller, and the backend uses it purely to
 * check and flip `has_voted`. The stored response holds no reference back to the account, so no
 * identifier may be added to this payload.
 */
export async function submitSurvey(payload: Record<string, unknown>): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/surveys/submit`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw { status: "network_error", message: NETWORK_ERROR } satisfies ApiError;
  }

  if (response.ok) return;

  const body = await response.json().catch(() => null);

  if (response.status === 401) {
    throw {
      status: "error",
      message: "Your session has expired. Sign in again to submit.",
    } satisfies ApiError;
  }

  if (response.status === 409) {
    throw {
      status: "already_submitted",
      message: "This account has already submitted a response. Thanks again!",
    } satisfies ApiError;
  }

  throw readErrorBody(body, response.status);
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    "status" in value
  );
}

export function errorMessage(value: unknown): string {
  return isApiError(value) ? value.message : GENERIC_ERROR;
}
