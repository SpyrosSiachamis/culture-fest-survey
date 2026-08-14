"""End-to-end coverage of the email verification flow and the security rules around it."""

import datetime as dt

import pytest

from src.database.models import Account, EmailVerificationCode
from src.verification import (
    MAX_ATTEMPTS,
    RESEND_COOLDOWN_SECONDS,
    hash_code,
    utcnow,
)
from tests.helpers import VALID_SIGNUP, code_from_email, get_account, signup


# --------------------------------------------------------------------------------------------
# Signup
# --------------------------------------------------------------------------------------------

def test_signup_creates_pending_account_and_emails_a_code(client, sent_emails, db_session):
    response = client.post("/accounts/signup", json=VALID_SIGNUP)

    assert response.status_code == 202
    body = response.json()
    assert body["expires_in_minutes"] == 15

    account = get_account(db_session, VALID_SIGNUP["email"])
    assert account is not None
    assert account.email_verified_at is None, "A new account must start out unverified"

    assert len(sent_emails) == 1
    email = sent_emails[0]
    assert email["to"] == VALID_SIGNUP["email"]
    assert "Culture Fest" in email["text"]
    assert "expires in 15 minutes" in email["text"]
    assert "ignore this email" in email["text"]
    assert len(code_from_email(email)) == 6


def test_signup_rejects_weak_password_and_bad_phone(client):
    short_password = client.post(
        "/accounts/signup", json={**VALID_SIGNUP, "password": "short"}
    )
    assert short_password.status_code == 422

    bad_phone = client.post("/accounts/signup", json={**VALID_SIGNUP, "phone": "not-a-phone"})
    assert bad_phone.status_code == 422

    bad_email = client.post("/accounts/signup", json={**VALID_SIGNUP, "email": "nope"})
    assert bad_email.status_code == 422


# --------------------------------------------------------------------------------------------
# Verification
# --------------------------------------------------------------------------------------------

def test_successful_signup_and_verification(client, sent_emails, db_session):
    code, payload = signup(client, sent_emails)

    response = client.post(
        "/accounts/verify-email", json={"email": payload["email"], "code": code}
    )

    assert response.status_code == 200
    assert response.json()["status"] == "verified"

    account = get_account(db_session, payload["email"])
    assert account.email_verified_at is not None

    # The record is cleaned up once it has done its job.
    assert db_session.query(EmailVerificationCode).count() == 0


def test_incorrect_code_is_rejected(client, sent_emails, db_session):
    code, payload = signup(client, sent_emails)
    wrong = "000000" if code != "000000" else "111111"

    response = client.post(
        "/accounts/verify-email", json={"email": payload["email"], "code": wrong}
    )

    assert response.status_code == 400
    assert response.json()["detail"]["status"] == "invalid"

    account = get_account(db_session, payload["email"])
    assert account.email_verified_at is None

    record = db_session.query(EmailVerificationCode).one()
    assert record.attempts == 1


def test_expired_code_is_rejected(client, sent_emails, db_session):
    code, payload = signup(client, sent_emails)

    record = db_session.query(EmailVerificationCode).one()
    record.expires_at = utcnow() - dt.timedelta(seconds=1)
    db_session.commit()

    response = client.post(
        "/accounts/verify-email", json={"email": payload["email"], "code": code}
    )

    assert response.status_code == 400
    assert response.json()["detail"]["status"] == "expired"

    account = get_account(db_session, payload["email"])
    assert account.email_verified_at is None
    # An expired code is discarded, so it cannot be retried without a resend.
    assert db_session.query(EmailVerificationCode).count() == 0


def test_code_is_single_use(client, sent_emails):
    code, payload = signup(client, sent_emails)

    first = client.post("/accounts/verify-email", json={"email": payload["email"], "code": code})
    assert first.status_code == 200

    replayed = client.post(
        "/accounts/verify-email", json={"email": payload["email"], "code": code}
    )

    assert replayed.status_code == 409
    assert replayed.json()["detail"]["status"] == "already_verified"


def test_too_many_attempts_burns_the_code(client, sent_emails, db_session):
    code, payload = signup(client, sent_emails)
    wrong = "000000" if code != "000000" else "111111"

    for _ in range(MAX_ATTEMPTS - 1):
        response = client.post(
            "/accounts/verify-email", json={"email": payload["email"], "code": wrong}
        )
        assert response.status_code == 400
        assert response.json()["detail"]["status"] == "invalid"

    final = client.post(
        "/accounts/verify-email", json={"email": payload["email"], "code": wrong}
    )
    assert final.status_code == 429
    assert final.json()["detail"]["status"] == "too_many_attempts"

    # The record is destroyed, so even the correct code no longer works.
    assert db_session.query(EmailVerificationCode).count() == 0
    retry = client.post("/accounts/verify-email", json={"email": payload["email"], "code": code})
    assert retry.status_code == 400
    assert retry.json()["detail"]["status"] == "invalid"

    account = get_account(db_session, payload["email"])
    assert account.email_verified_at is None


# --------------------------------------------------------------------------------------------
# Resend
# --------------------------------------------------------------------------------------------

def test_resend_is_blocked_during_the_cooldown(client, sent_emails):
    _code, payload = signup(client, sent_emails)
    assert len(sent_emails) == 1

    response = client.post("/accounts/verify-email/resend", json={"email": payload["email"]})

    # Accepted, but silently not sent — the response must not reveal the cooldown state.
    assert response.status_code == 202
    assert response.json()["cooldown_seconds"] == RESEND_COOLDOWN_SECONDS
    assert len(sent_emails) == 1, "A second code must not be sent inside the cooldown window"


def test_successful_resend_after_cooldown_invalidates_the_previous_code(
    client, sent_emails, db_session
):
    first_code, payload = signup(client, sent_emails)

    record = db_session.query(EmailVerificationCode).one()
    record.last_sent_at = utcnow() - dt.timedelta(seconds=RESEND_COOLDOWN_SECONDS + 1)
    db_session.commit()

    response = client.post("/accounts/verify-email/resend", json={"email": payload["email"]})
    assert response.status_code == 202
    assert len(sent_emails) == 2

    second_code = code_from_email(sent_emails[-1])

    # The superseded code no longer works...
    if second_code != first_code:
        stale = client.post(
            "/accounts/verify-email", json={"email": payload["email"], "code": first_code}
        )
        assert stale.status_code == 400
        assert stale.json()["detail"]["status"] == "invalid"

    # ...but the new one does.
    fresh = client.post(
        "/accounts/verify-email", json={"email": payload["email"], "code": second_code}
    )
    assert fresh.status_code == 200


def test_resend_for_unknown_address_looks_identical(client, sent_emails):
    response = client.post(
        "/accounts/verify-email/resend", json={"email": "nobody@example.com"}
    )

    assert response.status_code == 202
    assert response.json()["message"]
    assert sent_emails == [], "Nothing may be sent for an address with no account"


# --------------------------------------------------------------------------------------------
# Storage
# --------------------------------------------------------------------------------------------

def test_code_is_never_stored_in_plaintext(client, sent_emails, db_session):
    code, _payload = signup(client, sent_emails)

    record = db_session.query(EmailVerificationCode).one()

    assert record.code_hash != code
    assert len(record.code_hash) == 64
    assert record.code_hash == hash_code(code, record.account_id)

    # The code must not appear in *any* column of the row, under any name.
    stored_values = [
        str(getattr(record, column.name)) for column in EmailVerificationCode.__table__.columns
    ]
    assert code not in stored_values

    # ...nor anywhere in the raw table contents.
    raw_rows = db_session.execute(
        EmailVerificationCode.__table__.select()
    ).fetchall()
    assert code not in " ".join(str(value) for row in raw_rows for value in row)


def test_plaintext_email_is_never_stored(client, sent_emails, db_session):
    _code, payload = signup(client, sent_emails)

    raw_rows = db_session.execute(Account.__table__.select()).fetchall()
    dumped = " ".join(str(value) for row in raw_rows for value in row)

    assert payload["email"] not in dumped
    assert payload["phone"] not in dumped


# --------------------------------------------------------------------------------------------
# Enumeration resistance
# --------------------------------------------------------------------------------------------

def test_signup_response_is_identical_for_a_taken_address(client, sent_emails, db_session):
    code, payload = signup(client, sent_emails)
    client.post("/accounts/verify-email", json={"email": payload["email"], "code": code})

    first_body = client.post("/accounts/signup", json=VALID_SIGNUP).json()
    fresh_body = client.post(
        "/accounts/signup",
        json={**VALID_SIGNUP, "email": "someone-else@example.com", "phone": "+306999999999"},
    ).json()

    assert first_body == fresh_body, "Signup must not reveal that an account already exists"

    # The verified account is left completely alone...
    assert db_session.query(Account).filter(
        Account.email_hash == get_account(db_session, payload["email"]).email_hash
    ).one().email_verified_at is not None

    # ...and its owner is told about the attempt instead of receiving a code.
    notice = [email for email in sent_emails if "already exists" in email["subject"]]
    assert len(notice) == 1
    assert notice[0]["to"] == payload["email"]


def test_pending_signup_does_not_squat_an_address(client, sent_emails, db_session):
    """An unverified account has no proven owner, so a later signup replaces it."""
    signup(client, sent_emails)
    original_id = get_account(db_session, VALID_SIGNUP["email"]).id

    second_code, _payload = signup(client, sent_emails, password="a-different-password")
    db_session.expire_all()

    account = get_account(db_session, VALID_SIGNUP["email"])
    assert account.id != original_id
    assert db_session.query(Account).count() == 1
    assert db_session.query(EmailVerificationCode).count() == 1

    verified = client.post(
        "/accounts/verify-email", json={"email": VALID_SIGNUP["email"], "code": second_code}
    )
    assert verified.status_code == 200


def test_verify_does_not_reveal_unknown_addresses(client, sent_emails):
    code, payload = signup(client, sent_emails)
    wrong = "000000" if code != "000000" else "111111"

    unknown = client.post(
        "/accounts/verify-email", json={"email": "nobody@example.com", "code": wrong}
    )
    known_but_wrong = client.post(
        "/accounts/verify-email", json={"email": payload["email"], "code": wrong}
    )

    assert unknown.status_code == known_but_wrong.status_code == 400
    assert unknown.json() == known_but_wrong.json()


# --------------------------------------------------------------------------------------------
# Rate limiting
# --------------------------------------------------------------------------------------------

@pytest.mark.parametrize(
    "path, payload, limit",
    [
        ("/accounts/signup", VALID_SIGNUP, 5),
        (
            "/accounts/verify-email",
            {"email": VALID_SIGNUP["email"], "code": "000000"},
            10,
        ),
        ("/accounts/verify-email/resend", {"email": VALID_SIGNUP["email"]}, 3),
    ],
)
def test_endpoints_are_rate_limited(client, sent_emails, path, payload, limit):
    for _ in range(limit):
        assert client.post(path, json=payload).status_code != 429

    assert client.post(path, json=payload).status_code == 429


# --------------------------------------------------------------------------------------------
# Unverified account restrictions
# --------------------------------------------------------------------------------------------

def test_unverified_account_cannot_log_in(client, sent_emails):
    _code, payload = signup(client, sent_emails)

    response = client.post(
        "/accounts/login", json={"email": payload["email"], "password": payload["password"]}
    )

    assert response.status_code == 403
    assert response.json()["detail"]["status"] == "email_not_verified"


def test_login_succeeds_once_verified(client, sent_emails):
    code, payload = signup(client, sent_emails)
    client.post("/accounts/verify-email", json={"email": payload["email"], "code": code})

    response = client.post(
        "/accounts/login", json={"email": payload["email"], "password": payload["password"]}
    )

    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"


def test_unverified_account_cannot_submit_a_survey(client, sent_emails, db_session):
    """Defence in depth: a token minted before verification existed must not work either."""
    from src.auth import create_access_token
    from tests.helpers import SURVEY_PAYLOAD

    _code, payload = signup(client, sent_emails)
    account = get_account(db_session, payload["email"])
    token = create_access_token(account.id, dt.timedelta(minutes=15))

    response = client.post(
        "/surveys/submit",
        json=SURVEY_PAYLOAD,
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
