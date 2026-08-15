
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

## Admin dashboard

At `/admin/dashboard`. Three pages behind one collapsible aside: **Overview** (platform size,
accounts-versus-surveys over a rolling window, participation), **Responses** (every answer
distribution, filterable, with the raw numbers underneath) and **Admins** (who has access, and how
to add someone).

### Getting in

There is no admin login. An admin signs in at the ordinary Culture Fest sign-in page with the
session everything else uses; the only difference is the `role` column on their account.

The first admin has to be made from the server, because creating one through the API requires
already being one:

```bash
# sign up and verify the email through the normal flow first, then:
docker compose exec backend python -m src.scripts.promote_admin you@example.com
```

After that, admins create each other from the Admins page. The new account is created immediately
but is inert until its emailed code is entered — same rule as every other account, so a typo in the
address cannot mint an admin nobody can sign in as.

### How it is hidden

Every `/admin/*` endpoint answers **404**, byte for byte identical to a route that does not exist,
to anyone who is not a signed-in verified admin — anonymous callers and ordinary signed-in users
alike. A 401 would confirm the route exists; a 403 would tell a user there is an area they are being
kept out of.

The check runs on the API, on every endpoint, so calling the paths directly with curl is refused
exactly the same way. Hiding the frontend route is a courtesy, not the protection. `role` is not a
field on any request model anywhere in the application, so there is nothing for a user to send in
order to promote themselves.

### One source of truth for the categories

The dashboard hardcodes no answer options. `src/enums.py` declares them, `SurveyIn` in
`src/schemas.py` types every categorical field as its enum, and `src/analytics.py` derives the
filter catalogue by introspecting that model — which `/admin/analytics/schema` serves to the
frontend. Adding an option to an enum makes it a filter, a bar and a row of stats with no other
change; it is also, from the same edit, a value the survey API will accept.

Labels are the one thing not derived. They live in `frontend/locales/*.json` under
`survey.<field>.options.<value>.label` — the survey's own copy, reused, so a category is translated
once. An option with no locale entry yet renders as its raw value rather than disappearing.

### Time windows

`24h`, `3d` and `7d`, all rolling back from the current server time rather than calendar buckets, so
the numbers move continuously instead of resetting at midnight. All-time totals are always shown
alongside, and the Responses page adds an all-time option since the default view of the answers is
all of them.

Note that "surveys" is counted from submitted responses, never from accounts — an account that
exists is not a completed survey, and the gap between the two is shown rather than smoothed over.

### Anonymity

Nothing on the dashboard can identify a respondent. `survey_responses` holds no account reference,
the analytics endpoints return counts rather than rows, and free-text answers (`open_feedback`,
`accommodation_area`) are excluded from the catalogue entirely — there is nothing to bucket, and
`accommodation_area` is the one answer the survey itself warns could identify someone. Admin
accounts are listed as a reference and a date, because a peppered hash is all that is stored.

## Tests

```bash
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt -r requirements-dev.txt
.venv/bin/python -m pytest
```

The suite runs against a throwaway SQLite database and never sends email or touches the network.

## Status

In development
