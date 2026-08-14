
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

## Tests

```bash
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt -r requirements-dev.txt
.venv/bin/python -m pytest
```

The suite runs against a throwaway SQLite database and never sends email or touches the network.

## Status

In development
