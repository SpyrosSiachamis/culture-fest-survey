
# Culture Fest Survey

Survey app for the Culture Fest event (Hersonissos, Crete) — built with Next.js + FastAPI.

## Stack

- Frontend: Next.js
- Backend: FastAPI
- Database: MySQL + myphpadmin
- Deployment: `culturefestgreece.gr` (frontend) + `api.culturefestgreece.gr` (backend)

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
| `AUTH_COOKIE_SAMESITE` | `lax` | Also the CSRF defence. Correct in production too — see below. `none` requires `Secure`. |
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

At `/admin/dashboard`. Four pages behind one collapsible aside: **Overview** (platform size,
accounts-versus-surveys over a rolling window, participation), **Responses** (every answer
distribution, filterable, with the raw numbers underneath), **Lookup** (search an account by the
reference on its profile and see its voted / verified / redeemed status — the manual fallback for
when the door scanner cannot confirm a pass) and **Admins** (who has access, and how to add someone).

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

### Time

Every stored timestamp is **Europe/Athens** local wall-clock time — the festival's own timezone —
set by one application clock (`backend/src/clock.py`) so records, the rolling-window maths and every
displayed time all agree. Change it with `APP_TIMEZONE` if the event moves; the test suite pins it to
UTC for determinism. Timestamps written before this change are UTC and read three hours early until
they age out.

### Anonymity

Nothing on the dashboard can identify a respondent. `survey_responses` holds no account reference,
the analytics endpoints return counts rather than rows, and free-text answers (`open_feedback`,
`accommodation_area`) are excluded from the catalogue entirely — there is nothing to bucket, and
`accommodation_area` is the one answer the survey itself warns could identify someone. Admin
accounts are listed as a reference and a date, because a peppered hash is all that is stored.

The Lookup page is the one place account status is shown by reference, but it exposes only the voted
/ verified / redeemed flags and their timestamps — never the email or phone (only hashes exist), and
because responses carry no account id, nothing there is tied back to a survey answer.

## Production

`docker-compose.yml` is the **development** stack: it publishes phpMyAdmin and the MySQL port,
runs the dev servers with live reload, and serves plain HTTP — all fine over a private tailnet, none
of it safe on a public host. Deploy with the separate production file instead:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

It drops phpMyAdmin, gives the database no host port (only the backend reaches it), binds the app
ports to `127.0.0.1` for a TLS reverse proxy (Caddy, or `tailscale serve`) to front, runs real
builds, and sets `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAMESITE=none` and `TRUSTED_PROXY_IPS`
in the compose file itself. Those three live there rather than in `backend/.env` because that
file is shared with the dev stack, where each of them would break it.

Before deploying, set in `backend/.env`:

- strong `SECRET_KEY` / `PEPPER` / DB passwords (`openssl rand -hex 32` for the first two);
- `ALLOWED_ORIGINS` — the real public origin(s), **without a trailing slash**. A browser's
  `Origin` header never carries one, so `https://example.com/` would never match and the real
  frontend would be refused by CORS. The app strips one defensively, but do not rely on it.

`docker-compose.prod.yml` also pins `ALLOWED_ORIGINS` to the real origins, overriding the dev
list in `backend/.env` — those are credentialed origins, so a page on a developer's machine
must not be able to make authenticated calls against the live API.

### Why the session cookie stays `SameSite=Lax`

`culturefestgreece.gr` and `api.culturefestgreece.gr` are different **origins** but the same **site**:
SameSite is judged on the registrable domain (`culturefestgreece.gr` — `.gr` is the public suffix),
so the subdomain split is same-site and a `Lax` cookie is sent on the frontend's API calls,
exactly as in dev. CORS and `credentials: "include"` are still required, because they are
still cross-origin.

This matters because `Lax` is the *entire* CSRF defence — there is no CSRF token. Only moving
the frontend to a different domain (a `*.vercel.app` URL, say) would force `none`, and that
would leave the API relying on the fact that it parses no body unless it arrives as
`application/json`, forcing a preflight that `ALLOWED_ORIGINS` refuses. `none` also requires
`Secure`; `src/auth.py` refuses to start if the two disagree, rather than letting the browser
drop the cookie silently.

The cookie is host-only (`AUTH_COOKIE_DOMAIN` unset), so it is returned to
`api.culturefestgreece.gr` alone and never broadcast to other subdomains. Leave it that way.

### The one setting production gets wrong by default

**`TRUSTED_PROXY_IPS=172.16.0.0/12`.** The rate limiter keys on the client IP, and behind a proxy
every request arrives from the proxy; without this, all callers share one bucket and per-IP
brute-force limits stop working. Note this is **not** `127.0.0.1`: the backend runs in a container
reached over Docker's bridge, so a proxy on the host arrives from the bridge gateway (`172.x.0.1`), and a compose network's gateway is allocated dynamically — hence the range
rather than a fixed address. Nothing off-host can reach the container (the published port binds
`127.0.0.1`), so only the proxy and the sibling services are in it. Never `*`.

Finally, the frontend needs `NEXT_PUBLIC_API_URL=https://api.culturefestgreece.gr`. It is inlined at
**build** time, so it must be set wherever the frontend is built; unset, `lib/api.ts` falls back to
the page's own hostname on port 5000 and every call fails.

## Tests

```bash
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt -r requirements-dev.txt
.venv/bin/python -m pytest
```

The suite runs against a throwaway SQLite database and never sends email or touches the network.

## Status

In development
