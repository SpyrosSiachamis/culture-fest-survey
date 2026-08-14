/**
 * Thin client for the FastAPI backend.
 *
 * Everything here is a convenience for the UI only. The server revalidates every field and owns
 * every security decision — nothing on this side of the wire is trusted.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** Machine-readable states the verification endpoints can report back. */
export type VerificationStatus =
  | "verified"
  | "invalid"
  | "expired"
  | "too_many_attempts"
  | "already_verified"
  | "rate_limited"
  | "network_error";

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

async function post<T>(path: string, payload: unknown): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

export function signup(input: SignupInput) {
  return post<SignupAccepted>("/accounts/signup", input);
}

export function verifyEmail(email: string, code: string) {
  return post<VerificationResult>("/accounts/verify-email", { email, code });
}

export function resendVerificationCode(email: string) {
  return post<ResendAccepted>("/accounts/verify-email/resend", { email });
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
