"""The session cookie, the /accounts/me profile, and the door-redemption state machine."""

import datetime as dt

import jwt

from src.auth import ALGORITHM, AUTH_COOKIE_NAME, SECRET_KEY, create_access_token
from src.redemption import REDEMPTION_SCOPE
from tests.helpers import SURVEY_PAYLOAD, get_account, signup


def _decode_qr(token: str) -> dict:
    """Read a QR credential the way the future door endpoint will."""
    return jwt.decode(token, str(SECRET_KEY), algorithms=[str(ALGORITHM)])


def _verified_account(client, sent_emails, **overrides) -> dict[str, str]:
    """Sign up and verify, leaving the account ready to log in."""
    code, payload = signup(client, sent_emails, **overrides)
    verified = client.post(
        "/accounts/verify-email", json={"email": payload["email"], "code": code}
    )
    assert verified.status_code == 200
    return payload


def _login(client, payload) -> None:
    response = client.post(
        "/accounts/login", json={"email": payload["email"], "password": payload["password"]}
    )
    assert response.status_code == 200


# --- Session persistence ------------------------------------------------------------------------


def test_login_sets_an_httponly_session_cookie(client, sent_emails):
    payload = _verified_account(client, sent_emails)

    response = client.post(
        "/accounts/login", json={"email": payload["email"], "password": payload["password"]}
    )

    assert response.status_code == 200
    assert AUTH_COOKIE_NAME in response.cookies

    cookie_header = response.headers["set-cookie"]
    assert "HttpOnly" in cookie_header
    assert "Path=/" in cookie_header
    # A Max-Age is what makes the session outlive the tab, not just the page.
    assert "Max-Age=" in cookie_header


def test_profile_is_reachable_with_only_the_cookie(client, sent_emails):
    """This is the refresh case: no Authorization header, just what the browser sends back."""
    payload = _verified_account(client, sent_emails)
    _login(client, payload)

    response = client.get("/accounts/me")

    assert response.status_code == 200
    assert response.json()["email_verified"] is True


def test_failed_login_sets_no_cookie(client, sent_emails):
    payload = _verified_account(client, sent_emails)

    response = client.post(
        "/accounts/login", json={"email": payload["email"], "password": "wrong-password"}
    )

    assert response.status_code == 401
    assert AUTH_COOKIE_NAME not in response.cookies


def test_logout_clears_the_session(client, sent_emails):
    payload = _verified_account(client, sent_emails)
    _login(client, payload)
    assert client.get("/accounts/me").status_code == 200

    assert client.post("/accounts/logout").status_code == 204

    assert client.get("/accounts/me").status_code == 401


def test_expired_cookie_is_rejected(client, sent_emails, db_session):
    payload = _verified_account(client, sent_emails)
    account = get_account(db_session, payload["email"])
    client.cookies.set(
        AUTH_COOKIE_NAME, create_access_token(account.id, dt.timedelta(minutes=-1))
    )

    assert client.get("/accounts/me").status_code == 401


def test_forged_cookie_is_rejected(client):
    client.cookies.set(AUTH_COOKIE_NAME, "not.a.real.token")

    assert client.get("/accounts/me").status_code == 401


def test_bearer_token_still_works_alongside_the_cookie(client, sent_emails):
    """The header path must keep working — API clients and the survey flow rely on it."""
    payload = _verified_account(client, sent_emails)
    token = client.post(
        "/accounts/login", json={"email": payload["email"], "password": payload["password"]}
    ).json()["access_token"]
    client.cookies.clear()

    response = client.get("/accounts/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200


# --- Authorisation ------------------------------------------------------------------------------


def test_profile_requires_authentication(client):
    assert client.get("/accounts/me").status_code == 401


def test_profile_ignores_any_id_supplied_by_the_caller(client, sent_emails, db_session):
    """The profile follows the session, never a caller-supplied identifier."""
    mine = _verified_account(client, sent_emails)
    _verified_account(
        client,
        sent_emails,
        email="someone-else@example.com",
        phone="+306999999999",
    )
    other = get_account(db_session, "someone-else@example.com")

    _login(client, mine)
    tampered = client.get(
        f"/accounts/me?user_id={other.id}&account_id={other.id}&id={other.id}"
    )

    assert tampered.status_code == 200
    assert tampered.json()["reference"] != other.id.split("-")[0].upper()
    assert tampered.json()["reference"] == get_account(db_session, mine["email"]).id.split("-")[0].upper()


def test_profile_never_exposes_sensitive_fields(client, sent_emails):
    payload = _verified_account(client, sent_emails)
    _login(client, payload)

    body = client.get("/accounts/me").json()

    for leaked in ("email", "phone", "email_hash", "phone_hash", "hashed_password", "role", "id"):
        assert leaked not in body, f"{leaked} must not be exposed to the profile page"


def test_unverified_account_cannot_read_a_profile(client, sent_emails, db_session):
    """A token minted before verification must not open the profile."""
    _code, payload = signup(client, sent_emails)
    account = get_account(db_session, payload["email"])
    client.cookies.set(AUTH_COOKIE_NAME, create_access_token(account.id, dt.timedelta(minutes=15)))

    assert client.get("/accounts/me").status_code == 403


# --- Redemption state machine -------------------------------------------------------------------


def test_new_account_is_not_eligible_and_gets_no_qr(client, sent_emails):
    payload = _verified_account(client, sent_emails)
    _login(client, payload)

    body = client.get("/accounts/me").json()

    assert body["has_voted"] is False
    assert body["redemption"]["status"] == "not_eligible"
    # No credential is issued to an account that cannot use one.
    assert body["redemption"]["token"] is None


def test_survey_submission_makes_the_account_eligible(client, sent_emails, db_session):
    payload = _verified_account(client, sent_emails)
    _login(client, payload)

    assert client.post("/surveys/submit", json=SURVEY_PAYLOAD).status_code == 201

    account = get_account(db_session, payload["email"])
    assert account.has_voted is True
    assert account.allowed_to_redeem is True
    assert account.has_redeemed is False
    assert account.redeemed_at is None

    body = client.get("/accounts/me").json()
    assert body["redemption"]["status"] == "ready"
    assert body["redemption"]["token"]


def test_qr_credential_carries_only_what_the_door_needs(client, sent_emails, db_session):
    payload = _verified_account(client, sent_emails)
    _login(client, payload)
    client.post("/surveys/submit", json=SURVEY_PAYLOAD)

    claims = _decode_qr(client.get("/accounts/me").json()["redemption"]["token"])
    account = get_account(db_session, payload["email"])

    assert claims["account_id"] == account.id
    assert claims["voted"] is True
    assert claims["scope"] == REDEMPTION_SCOPE
    # Expires, so a code cannot be kept and presented at a future festival.
    assert claims["exp"] > dt.datetime.now(dt.timezone.utc).timestamp()
    # Nothing about who they are or what they answered.
    assert set(claims) == {"account_id", "voted", "scope", "exp"}


def test_qr_credential_is_not_a_session_token(client, sent_emails):
    """A photographed QR must not become a way to act as the account it belongs to."""
    payload = _verified_account(client, sent_emails)
    _login(client, payload)
    client.post("/surveys/submit", json=SURVEY_PAYLOAD)
    qr_token = client.get("/accounts/me").json()["redemption"]["token"]
    client.cookies.clear()

    assert client.get("/accounts/me", headers={"Authorization": f"Bearer {qr_token}"}).status_code == 401

    client.cookies.set(AUTH_COOKIE_NAME, qr_token)
    assert client.get("/accounts/me").status_code == 401
    assert client.post("/surveys/submit", json=SURVEY_PAYLOAD).status_code == 401


def test_two_eligible_accounts_get_different_credentials(client, sent_emails):
    first = _verified_account(client, sent_emails)
    _login(client, first)
    client.post("/surveys/submit", json=SURVEY_PAYLOAD)
    first_token = client.get("/accounts/me").json()["redemption"]["token"]
    client.post("/accounts/logout")

    second = _verified_account(
        client, sent_emails, email="second@example.com", phone="+306911111111"
    )
    _login(client, second)
    client.post("/surveys/submit", json=SURVEY_PAYLOAD)
    second_token = client.get("/accounts/me").json()["redemption"]["token"]

    assert _decode_qr(first_token)["account_id"] != _decode_qr(second_token)["account_id"]


def test_redeemed_account_shows_claimed_and_no_qr(client, sent_emails, db_session):
    """Once the (not-yet-built) door scan flips has_redeemed, the pass stops being presentable."""
    payload = _verified_account(client, sent_emails)
    _login(client, payload)
    client.post("/surveys/submit", json=SURVEY_PAYLOAD)

    account = get_account(db_session, payload["email"])
    account.has_redeemed = True
    account.redeemed_at = dt.datetime(2026, 8, 20, 21, 30)
    db_session.commit()

    body = client.get("/accounts/me").json()

    assert body["redemption"]["status"] == "redeemed"
    assert body["redemption"]["token"] is None
    assert body["redemption"]["redeemed_at"].startswith("2026-08-20T21:30")


def test_redemption_status_fallback_reports_only_the_claim(client, sent_emails, db_session):
    payload = _verified_account(client, sent_emails)
    _login(client, payload)
    client.post("/surveys/submit", json=SURVEY_PAYLOAD)

    before = client.get("/accounts/me/redemption-status").json()
    assert before == {"has_redeemed": False, "redeemed_at": None}

    account = get_account(db_session, payload["email"])
    account.has_redeemed = True
    account.redeemed_at = dt.datetime(2026, 8, 20, 21, 30)
    db_session.commit()

    after = client.get("/accounts/me/redemption-status").json()
    assert after["has_redeemed"] is True
    assert after["redeemed_at"].startswith("2026-08-20T21:30")
    # Narrow by design: no QR, no account details.
    assert set(after) == {"has_redeemed", "redeemed_at"}


def test_redemption_status_requires_authentication(client):
    assert client.get("/accounts/me/redemption-status").status_code == 401


def test_redemption_state_cannot_be_set_from_the_client(client, sent_emails, db_session):
    """Nothing the profile page can send may change eligibility or claimed status."""
    payload = _verified_account(client, sent_emails)
    _login(client, payload)

    # There is no write endpoint for these at all — the profile is read-only ...
    assert client.post("/accounts/me", json={"has_redeemed": True}).status_code == 405
    # ... and the one endpoint that does touch them ignores anything extra in the body.
    client.post(
        "/surveys/submit",
        json={**SURVEY_PAYLOAD, "has_redeemed": True, "allowed_to_redeem": False},
    )

    account = get_account(db_session, payload["email"])
    assert account.allowed_to_redeem is True
    assert account.has_redeemed is False
    assert account.redeemed_at is None
