
# Culture Fest Survey

Survey app for the Culture Fest event (Hersonissos, Crete) — built with Next.js + FastAPI.

## Stack

- Frontend: Next.js
- Backend: FastAPI
- Database: MySQL + myphpadmin
- Deployment: Vercel (frontend) + TBD (backend)

## Setup

Three environment files are needed. Copy each template and fill in real values:

```bash
cp .env.example .env                   # docker-compose ports + MySQL bootstrap
cp backend/.env.example backend/.env   # auth secrets, database, Resend
cp frontend/.env.example frontend/.env # backend URL for the browser
docker compose up --build
```

`SECRET_KEY` and `PEPPER` should each be a fresh random string (`openssl rand -hex 32`). Note that
changing `PEPPER` invalidates every existing login, since emails are matched by a peppered hash.

## Email verification

Signup does not activate an account on its own. The flow is:

1. `POST /accounts/signup` creates the account in a pending state and emails a 6-digit code
   (via [Resend](https://resend.com)). The response is identical whether or not the address is
   already registered, so the endpoint cannot be used to discover who has an account.
2. `POST /accounts/verify-email` checks the code and marks the address as verified.
3. `POST /accounts/verify-email/resend` sends a replacement code, subject to a 60-second cooldown.

Codes expire after 15 minutes, are single-use, and allow 5 attempts. Only an HMAC digest of a code
is ever stored — never the code itself. Until an account is verified it cannot log in and cannot
submit a survey.

The matching UI lives at `/signup` and `/verify`.

Set `RESEND_API_KEY` and `EMAIL_FROM` in `backend/.env` for mail to actually go out; without them
the app runs normally but logs a warning instead of sending.

## Sessions

`POST /accounts/login` returns a JWT **and** sets it as an HttpOnly cookie (`cf_session`). The
cookie is what keeps a visitor signed in: the browser re-sends it on every request, so a page
reload restores the session by asking the server who the caller is, rather than by trusting
anything the frontend remembered. JavaScript cannot read the cookie, so an XSS bug cannot steal
the session.

On load the frontend calls `GET /accounts/me`; a profile means signed in, a 401 means guest. Every
protected endpoint validates the token again server-side regardless. `POST /accounts/logout`
clears the cookie. The bearer header still works everywhere the cookie does, for API clients.

Relevant settings in `backend/.env` (see `.env.example` for the full notes):

| Variable | Default | Notes |
| --- | --- | --- |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `720` | Session length, and the cookie's max-age. |
| `AUTH_COOKIE_SECURE` | `false` | **Must be `true` when served over HTTPS.** |
| `AUTH_COOKIE_SAMESITE` | `lax` | Also the CSRF defence. `none` requires `Secure`. |
| `AUTH_COOKIE_DOMAIN` | unset | Host-only cookie unless set. |

The frontend must call the API with `credentials: "include"` (it does, in `lib/api.ts`) and the
browsing origin must appear in `ALLOWED_ORIGINS` — a wildcard CORS origin makes the browser drop
the cookie.

## Profile and the door pass

`/profile` shows the signed-in account: its reference, verification status, whether its survey is
in, and its QR pass. It reads `GET /accounts/me`, which resolves the account from the session and
accepts no identifier of any kind — there is no id in the request for a caller to swap.

Redemption is three columns on `accounts`, and nothing in `survey_responses` ever points back at
them:

```
new account          allowed_to_redeem = false, has_redeemed = false
survey submitted     allowed_to_redeem = true,  has_redeemed = false   -> QR shown
scanned at the door  allowed_to_redeem = true,  has_redeemed = true    -> QR withdrawn
```

The QR encodes a JWT holding only `account_id`, `voted: true`, a `redeem` scope and an expiry of
`EVENT_END` — no email, no answers, nothing about the account beyond having voted. Nothing is
stored for it: the token is minted on each profile view and rendered client-side. The `redeem`
scope is what stops a photographed QR from being replayed as a session token.

`GET /accounts/me/redemption-status` is the narrow fallback for a scan whose confirmation never
appeared on the staff device — it reports `has_redeemed` and `redeemed_at`, nothing else.

Not built yet, by design: the staff scanner UI and the redeem endpoint that flips `has_redeemed`.
That endpoint is the one that will also enforce `EVENT_START` (no redeeming before doors open).

[`docs/qr-redemption.md`](docs/qr-redemption.md) has the full picture: how the credential is
minted, what has to be configured before going live, and a build plan for the scanning half.

## Tests

```bash
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt -r requirements-dev.txt
.venv/bin/python -m pytest
```

The suite runs against a throwaway SQLite database and never sends email or touches the network.

## Status

In development
