# QR redemption — how it works, and how to finish it

Written 15 Aug 2026, alongside the profile-page work. Covers the user-facing half that is built,
what has to be true for it to work in production, and how to build the staff scanning half later.

---

## 1. The state machine

Three columns on `accounts`. Nothing in `survey_responses` ever points back at them, so the
answers stay anonymous — these are facts about the *account*, in the same category as `has_voted`.

```
new account          allowed_to_redeem = false   has_redeemed = false
survey submitted     allowed_to_redeem = true    has_redeemed = false   → QR shown
scanned at the door  allowed_to_redeem = true    has_redeemed = true    → QR withdrawn
                                                 redeemed_at  = <ts>
```

`allowed_to_redeem` is flipped in `POST /surveys/submit`, in the same commit as the response row.
`has_redeemed` and `redeemed_at` are flipped only by the door scan, which is not built yet.

## 2. What is built

```
survey submitted → allowed_to_redeem = true
        ↓
user opens /profile → GET /accounts/me (session cookie)
        ↓
backend: status "ready" → mints a JWT on the spot
        ↓
JSON: redemption.token = "eyJhbGci…"   (215 chars)
        ↓
browser draws it as an SVG QR — qrcode.react, in the page
```

- `GET /accounts/me` returns `redemption: { status, token, redeemed_at }`.
  `status` is one of `not_eligible` / `ready` / `redeemed`, resolved server-side so the frontend
  never has to combine the two flags itself.
- A token is issued **only** for `ready`. An ineligible or already-claimed account is sent no
  credential at all, rather than one the page is trusted to hide.
- `GET /accounts/me/redemption-status` is the narrow fallback — `has_redeemed` + `redeemed_at`,
  nothing else — for when the staff device fails to show a confirmation after a scan.

### What is in the QR

```json
{ "account_id": "ae0674ee-…", "voted": true, "scope": "redeem", "exp": 1789344303 }
```

Signed with `SECRET_KEY` / HS256. Four facts: who is claiming, that the claim was earned, what
kind of token this is, and when it dies. No email, no phone, no answers.

A JWT payload is base64, not encrypted — anyone who decodes the QR can read `voted: true`. That is
the accepted tradeoff: staff learn, in the moment of a scan, that this token belongs to someone
who voted. No name, no contact details, no browsable list.

### Three properties worth keeping

- **Nothing is stored.** No column, no image, no file. The token is derived from the account row
  plus `EVENT_END` on every profile view, so a database dump holds no redemption credential.
- **It is drawn locally.** `qrcode.react` renders the SVG in the browser from the string. No image
  endpoint, no external QR service — nothing outside the stack ever sees a token.
- **It cannot act as a login.** `scope: "redeem"` is rejected by `get_current_user`, so
  photographing someone's QR does not hand over their account. Without that claim the redemption
  JWT — same key, same `account_id` — would have been a valid session token. Tested both ways,
  header and cookie.

Density: 215 chars at error level M is a version-11 symbol (61 modules + quiet zone), rendered up
to 320px wide — about 4.9 screen pixels per module. Scans fine phone-to-phone at close range.

Verification at the door is signature-based, so the **visitor's** phone needs no signal. The staff
device does.

## 3. Going live

### Works unchanged

The QR rendering. Pure client-side drawing, no network call, no CDN, no third party. A screenshot
works too — and, like a paper ticket, is shareable; `has_redeemed` is what stops a second claim.

### Must be configured, or the QR never appears at all

1. **`AUTH_COOKIE_SECURE=true` on HTTPS.** False today for the plain-HTTP dev stack. Wrong in
   either direction and the browser silently refuses the session cookie — no login, no
   `/accounts/me`, no pass.

2. **Domain topology — the one that will bite.** If the API lands on a *different registrable
   domain* from the frontend (`fest.vercel.app` calling `api.something-else.com`), the cookie is
   third-party: `SameSite=lax` will not send it, and `none` + `Secure` still gets blocked outright
   by iOS Safari's tracking prevention. On a phone-first festival audience that is most users.
   Two safe shapes:
   - same registrable domain — `culturefest.gr` + `api.culturefest.gr`, keep `lax`; or
   - proxy the API under the frontend's own origin with a Next rewrite.

3. **`EVENT_END` with a timezone offset.** Unset, tokens expire 30 days after each view. Naive
   values are read as UTC, so `2026-09-01T04:00:00` means 07:00 in Crete — write
   `2026-09-01T04:00:00+03:00`.

4. **The same `SECRET_KEY` on every backend replica**, and no rotation during the event —
   rotating invalidates every QR already screenshotted.

### Known gap

`frontend/components/AuthProvider.tsx:96` treats a failed profile fetch on page load as "signed
out". A visitor who reloads at the door with no signal sees the sign-in gate instead of their
pass. Either distinguish offline from signed-out and keep showing the last-known pass, or tell
people to screenshot it in advance.

---

## 4. Building the scanner side

```
staff tablet: /staff/scan  (logged in as an admin, same cookie session)
        ↓ camera decodes the QR → a 215-char string
POST /admin/redeem  { "token": "eyJhbGci…" }   credentials: include
        ↓ verify signature · check exp · check scope · check EVENT_START
        ↓ atomic UPDATE … WHERE has_redeemed = 0
200 { result: "redeemed", reference: "AE0674EE" }
        ↓
staff UI: full-screen green tick — "VALID · AE0674EE · hand over the bracelet"
```

### 4.1 Admin auth — reuse, do not rebuild

`Account.role` already exists and defaults to `USER`. One dependency, next to
`get_current_verified_user` in `src/auth.py`:

```python
def get_current_admin(account: Annotated[Account, Depends(get_current_verified_user)]) -> Account:
    if account.role != AccountType.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Staff only.")
    return account
```

Staff sign in through the normal login form and get the normal session cookie — no second auth
system. Promotion is a manual `UPDATE accounts SET role='ADMIN'` or a small CLI; deliberately no
self-serve path. This also fills in `requires_admin`, referenced in the commented-out block at
`src/routers/surveys.py:44`.

### 4.2 The redeem endpoint

New `src/routers/admin.py`, in the style of the existing routers:

```python
@router.post("/redeem", response_model=RedeemResult)
@limiter.limit("60/minute")
def redeem(request: Request, payload: RedeemRequest, db: Session = Depends(get_db),
           staff: Account = Depends(get_current_admin)):
    try:
        claims = jwt.decode(payload.token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        return RedeemResult(result="expired")        # last year's screenshot
    except jwt.InvalidTokenError:
        return RedeemResult(result="invalid")        # forged or mangled

    if claims.get("scope") != REDEMPTION_SCOPE:
        return RedeemResult(result="invalid")        # a session token is not a ticket
    if dt.datetime.now(dt.timezone.utc) < event_start():
        return RedeemResult(result="too_early")      # voting opens before the doors

    # Atomic: the guard is IN the UPDATE, so two tablets scanning the same code
    # at once cannot both come back "redeemed".
    updated = db.query(Account).filter(
        Account.id == claims["account_id"],
        Account.allowed_to_redeem.is_(True),
        Account.has_redeemed.is_(False),
    ).update({"has_redeemed": True, "redeemed_at": func.now()}, synchronize_session=False)
    db.commit()
    ...
```

**The race is the part to get right.** A read-then-write
(`if not account.has_redeemed: account.has_redeemed = True`) looks correct and loses: two staff
scanning the same screen at the same moment both read `False`, and both hand over a bracelet.
Putting the condition inside the `UPDATE` and checking `rowcount` makes the database arbitrate.
If `rowcount == 0`, re-read the row to tell "already claimed at 21:34" apart from "never voted".

Return **200 with a `result` field**, not HTTP error codes. Staff care about four outcomes, and
the UI should render them from one place rather than a mix of status codes and exceptions.

### 4.3 The scanner page

`/staff/scan`, a client component.

- `getUserMedia` needs a **secure context** — the live staff page must be HTTPS or the camera
  silently will not open. localhost is exempt, which is why it works in dev and surprises you in
  production.
- Decoding: `BarcodeDetector` is native and fast but absent on iOS Safari. If the door device
  might be an iPad, use `@zxing/browser` or the `barcode-detector` polyfill so one page covers
  both.
- **Lock after a successful decode.** A camera feeding 30fps into a decoder will fire the same
  token at the endpoint thirty times a second. Decode → freeze the frame → POST → hold the result
  until staff tap "Next".
- Beep and vibrate on result. At a loud door nobody is reading small text.

### 4.4 What staff see

Four states, unmistakable at arm's length in the dark:

| Result | Screen |
| --- | --- |
| `redeemed` | Full green, big tick, `AE0674EE` — hand it over |
| `already_claimed` | Amber — "claimed at 21:34" |
| `not_eligible` | Red — valid code, but this account never voted |
| `invalid` / `expired` / `too_early` | Red — do not hand anything over |

Show the **reference** (`AE0674EE`, the first segment of the account id) on the success screen. It
is the same string the visitor sees on their own profile, so when a screen fails mid-scan the two
can be matched by reading it aloud — pairing with the `/accounts/me/redemption-status` fallback.

Staff never see an email, a phone number or any answers. Only "this token belongs to an account
that voted".

### 4.5 Traps

- **Tablet loses signal.** The endpoint fails closed: no scan recorded, no bracelet. Queueing
  scans locally to sync later trades that for the risk of double-issuing. Fail-closed plus a
  backup list is usually right for a one-night event.
- **Bootstrap the first admin before doors open**, and test the scan path on the real tablet, on
  the real network, in advance. Camera permissions and HTTPS are exactly what fails at 20:00 on
  the night.
- **`EVENT_START`** is already documented in `backend/.env.example` and unused. This endpoint is
  the thing that reads it.

Rough size: the endpoint and its tests are small; the scanner page is most of the work.

---

## 5. File map

| Path | What it holds |
| --- | --- |
| `backend/src/redemption.py` | Mints the QR JWT. `EVENT_END`, the `redeem` scope, the payload. |
| `backend/src/auth.py` | Session cookie, `SESSION_SCOPE`, the guard that rejects a redeem token as a session. |
| `backend/src/routers/accounts.py` | `/accounts/me`, `/accounts/me/redemption-status`, login, logout. |
| `backend/src/routers/surveys.py` | Flips `allowed_to_redeem` on submit. |
| `backend/src/database/models.py` | The three redemption columns. |
| `backend/src/database/schema_patch.py` | Additive startup migration for them. |
| `backend/tests/test_profile.py` | Session persistence, authorisation, the state machine. |
| `frontend/app/profile/page.tsx` | The pass, in its three states. |
| `frontend/components/AuthProvider.tsx` | Restores the session from `/accounts/me` on load. |
| `frontend/lib/api.ts` | `credentials: "include"` on every call; API base URL derivation. |
