/**
 * In-memory access token store.
 *
 * Deliberately NOT localStorage or sessionStorage: the token is short-lived (15 minutes by
 * default) and keeping it in module state means it never survives a full page reload and is never
 * readable by anything that can reach browser storage. A reload simply sends the user back to
 * sign-in, which is the correct trade for a survey this short.
 */

let accessToken: string | null = null;

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearAccessToken(): void {
  accessToken = null;
}
