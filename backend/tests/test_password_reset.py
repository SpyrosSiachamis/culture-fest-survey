"""The email-based password reset flow.

Two properties carry most of the weight here and each has its own group of tests below: the request
endpoint must answer identically whether or not the address has an account, and a reset link must
work exactly once.
"""

import datetime as dt
import re

import jwt
import pytest

from src.auth import ALGORITHM, SECRET_KEY, create_access_token
from src.password_reset import (
    PASSWORD_RESET_SCOPE,
    _password_fingerprint,
    frontend_base_url,
)
from tests.helpers import get_account, signup

NEW_PASSWORD = "a-brand-new-passphrase"

_TOKEN_PATTERN = re.compile(r"reset-password\?token=([A-Za-z0-9._\-]+)")


def _verified_account(client, sent_emails, **overrides) -> dict[str, str]:
    code, payload = signup(client, sent_emails, **overrides)
    verified = client.post(
        "/accounts/verify-email", json={"email": payload["email"], "code": code}
    )
    assert verified.status_code == 200
    return payload


def _request_reset(client, email: str):
    return client.post("/accounts/password-reset/request", json={"email": email})


def _token_from_email(email: dict[str, str]) -> str:
    """Pull the token out of the link, the way a recipient's browser would."""
    match = _TOKEN_PATTERN.search(email["text"])
    assert match is not None, f"No reset link found in: {email['text']!r}"
    return match.group(1)


def _reset_token_for(client, sent_emails, payload) -> str:
    response = _request_reset(client, payload["email"])
    assert response.status_code == 202
    return _token_from_email(sent_emails[-1])


def _login(client, email: str, password: str):
    return client.post("/accounts/login", json={"email": email, "password": password})


# --- The happy path -----------------------------------------------------------------------------


def test_reset_link_is_emailed_to_an_existing_account(client, sent_emails):
    payload = _verified_account(client, sent_emails)
    sent_emails.clear()

    response = _request_reset(client, payload["email"])

    assert response.status_code == 202
    assert len(sent_emails) == 1
    message = sent_emails[-1]
    assert message["to"] == payload["email"]
    assert frontend_base_url() in message["text"]
    # The token is the credential, so the link must actually carry one.
    assert _token_from_email(message)


def test_a_reset_changes_the_password(client, sent_emails):
    payload = _verified_account(client, sent_emails)
    token = _reset_token_for(client, sent_emails, payload)

    confirmed = client.post(
        "/accounts/password-reset/confirm",
        json={"token": token, "new_password": NEW_PASSWORD},
    )
    assert confirmed.status_code == 200

    assert _login(client, payload["email"], NEW_PASSWORD).status_code == 200
    assert _login(client, payload["email"], payload["password"]).status_code == 401


def test_reset_works_for_an_account_that_never_verified(client, sent_emails):
    """Deliberate: the link proves ownership of the address just as the signup code does.

    The account still cannot sign in until it verifies — that rule is untouched here.
    """
    _code, payload = signup(client, sent_emails)
    sent_emails.clear()

    token = _reset_token_for(client, sent_emails, payload)
    confirmed = client.post(
        "/accounts/password-reset/confirm",
        json={"token": token, "new_password": NEW_PASSWORD},
    )

    assert confirmed.status_code == 200
    assert _login(client, payload["email"], NEW_PASSWORD).status_code == 403


# --- Enumeration: a request must reveal nothing -------------------------------------------------


def test_unknown_address_gets_the_same_answer_and_no_email(client, sent_emails):
    payload = _verified_account(client, sent_emails)
    sent_emails.clear()

    known = _request_reset(client, payload["email"])
    unknown = _request_reset(client, "nobody-at-all@example.com")

    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    # Only the real account was written to.
    assert [message["to"] for message in sent_emails] == [payload["email"]]


def test_response_is_byte_identical_for_hit_and_miss(client, sent_emails):
    _verified_account(client, sent_emails)

    hit = _request_reset(client, "attendee@example.com")
    miss = _request_reset(client, "someone-else@example.com")

    assert hit.content == miss.content
    # Headers a client could compare, other than the ones that legitimately differ per response.
    ignored = {"date", "server", "content-length"}
    assert {k.lower(): v for k, v in hit.headers.items() if k.lower() not in ignored} == {
        k.lower(): v for k, v in miss.headers.items() if k.lower() not in ignored
    }


def test_lookup_is_by_email_only_never_phone(client, sent_emails):
    """Phone is a login identifier elsewhere, but there is nothing to send a link to."""
    payload = _verified_account(client, sent_emails)
    sent_emails.clear()

    # The account's phone number, submitted where an email is expected, must not find it. It is not
    # a valid address either, so this is a 422 — the point is that no mail goes out.
    response = _request_reset(client, payload["phone"])

    assert response.status_code == 422
    assert sent_emails == []


def test_address_is_normalised_the_same_way_signup_normalises_it(client, sent_emails):
    payload = _verified_account(client, sent_emails)
    sent_emails.clear()

    response = _request_reset(client, f"  {payload['email'].upper()}  ")

    assert response.status_code == 202
    assert len(sent_emails) == 1


# --- Single use ---------------------------------------------------------------------------------


def test_a_used_link_cannot_be_used_again(client, sent_emails):
    payload = _verified_account(client, sent_emails)
    token = _reset_token_for(client, sent_emails, payload)

    first = client.post(
        "/accounts/password-reset/confirm",
        json={"token": token, "new_password": NEW_PASSWORD},
    )
    assert first.status_code == 200

    second = client.post(
        "/accounts/password-reset/confirm",
        json={"token": token, "new_password": "yet-another-password"},
    )
    assert second.status_code == 400
    assert second.json()["detail"]["status"] == "invalid_reset_token"

    # The second attempt must not have taken effect.
    assert _login(client, payload["email"], NEW_PASSWORD).status_code == 200
    assert _login(client, payload["email"], "yet-another-password").status_code == 401


def test_resetting_to_the_same_password_still_burns_the_link(client, sent_emails):
    """Argon2 salts every hash, so the fingerprint changes even when the password does not."""
    payload = _verified_account(client, sent_emails)
    token = _reset_token_for(client, sent_emails, payload)

    first = client.post(
        "/accounts/password-reset/confirm",
        json={"token": token, "new_password": payload["password"]},
    )
    assert first.status_code == 200

    second = client.post(
        "/accounts/password-reset/confirm",
        json={"token": token, "new_password": NEW_PASSWORD},
    )
    assert second.status_code == 400


def test_an_older_link_dies_when_a_newer_one_is_used(client, sent_emails):
    """Two links in flight: using either one invalidates the other."""
    payload = _verified_account(client, sent_emails)
    first_token = _reset_token_for(client, sent_emails, payload)
    second_token = _reset_token_for(client, sent_emails, payload)

    used = client.post(
        "/accounts/password-reset/confirm",
        json={"token": second_token, "new_password": NEW_PASSWORD},
    )
    assert used.status_code == 200

    stale = client.post(
        "/accounts/password-reset/confirm",
        json={"token": first_token, "new_password": "third-password-attempt"},
    )
    assert stale.status_code == 400


# --- Token forgery and misuse -------------------------------------------------------------------


def _mint(payload: dict) -> str:
    return jwt.encode(payload, str(SECRET_KEY), algorithm=str(ALGORITHM))


def test_expired_link_is_refused(client, sent_emails, db_session):
    payload = _verified_account(client, sent_emails)
    account = get_account(db_session, payload["email"])
    assert account is not None

    expired = _mint(
        {
            "account_id": account.id,
            "pwd": _password_fingerprint(account.hashed_password),
            "scope": PASSWORD_RESET_SCOPE,
            "exp": dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=1),
        }
    )

    response = client.post(
        "/accounts/password-reset/confirm",
        json={"token": expired, "new_password": NEW_PASSWORD},
    )

    assert response.status_code == 400
    assert response.json()["detail"]["status"] == "invalid_reset_token"
    assert _login(client, payload["email"], payload["password"]).status_code == 200


def test_a_session_token_cannot_be_replayed_as_a_reset_link(client, sent_emails, db_session):
    payload = _verified_account(client, sent_emails)
    account = get_account(db_session, payload["email"])
    assert account is not None

    session_token = create_access_token(account.id, dt.timedelta(minutes=15))

    response = client.post(
        "/accounts/password-reset/confirm",
        json={"token": session_token, "new_password": NEW_PASSWORD},
    )

    assert response.status_code == 400
    assert _login(client, payload["email"], payload["password"]).status_code == 200


def test_a_reset_token_cannot_be_replayed_as_a_session(client, sent_emails):
    payload = _verified_account(client, sent_emails)
    token = _reset_token_for(client, sent_emails, payload)

    response = client.get(
        "/accounts/me", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 401


def test_a_reset_token_for_one_account_cannot_reset_another(client, sent_emails, db_session):
    victim = _verified_account(client, sent_emails)
    attacker = _verified_account(
        client, sent_emails, email="attacker@example.com", phone="+306999999999"
    )

    attacker_token = _reset_token_for(client, sent_emails, attacker)
    victim_account = get_account(db_session, victim["email"])
    assert victim_account is not None

    # Swap the account id but keep the attacker's signature-covered payload otherwise intact: the
    # signature no longer matches, which is the whole point of signing it.
    decoded = jwt.decode(attacker_token, str(SECRET_KEY), algorithms=[str(ALGORITHM)])
    decoded["account_id"] = victim_account.id
    forged = jwt.encode(decoded, "not-the-server-key", algorithm=str(ALGORITHM))

    response = client.post(
        "/accounts/password-reset/confirm",
        json={"token": forged, "new_password": NEW_PASSWORD},
    )

    assert response.status_code == 400
    assert _login(client, victim["email"], victim["password"]).status_code == 200


def test_an_unsigned_token_is_refused(client, sent_emails, db_session):
    """The classic `alg: none` downgrade."""
    payload = _verified_account(client, sent_emails)
    account = get_account(db_session, payload["email"])
    assert account is not None

    unsigned = jwt.encode(
        {
            "account_id": account.id,
            "pwd": _password_fingerprint(account.hashed_password),
            "scope": PASSWORD_RESET_SCOPE,
            "exp": dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=10),
        },
        key="",
        algorithm="none",
    )

    response = client.post(
        "/accounts/password-reset/confirm",
        json={"token": unsigned, "new_password": NEW_PASSWORD},
    )

    assert response.status_code == 400


@pytest.mark.parametrize("token", ["", "not-a-jwt", "a.b.c", "  "])
def test_malformed_tokens_are_refused_without_a_500(client, token):
    response = client.post(
        "/accounts/password-reset/confirm",
        json={"token": token, "new_password": NEW_PASSWORD},
    )
    assert response.status_code == 400


def test_the_reset_token_carries_nothing_identifying(client, sent_emails):
    """A JWT is signed, not encrypted — anyone holding the link can read the payload."""
    payload = _verified_account(client, sent_emails)
    token = _reset_token_for(client, sent_emails, payload)

    body = jwt.decode(token, str(SECRET_KEY), algorithms=[str(ALGORITHM)])

    assert set(body) == {"account_id", "pwd", "scope", "exp"}
    serialised = str(body)
    assert payload["email"] not in serialised
    assert payload["phone"] not in serialised
    assert payload["password"] not in serialised


def test_the_fingerprint_is_not_the_password_hash(client, sent_emails, db_session):
    """Keyed, so intercepting the link does not hand over the Argon2 hash."""
    payload = _verified_account(client, sent_emails)
    token = _reset_token_for(client, sent_emails, payload)
    account = get_account(db_session, payload["email"])
    assert account is not None

    body = jwt.decode(token, str(SECRET_KEY), algorithms=[str(ALGORITHM)])

    assert body["pwd"] != account.hashed_password
    assert account.hashed_password not in str(body)


# --- Password rules and rate limiting -----------------------------------------------------------


@pytest.mark.parametrize("weak", ["", "short", "1234567"])
def test_reset_cannot_set_a_password_signup_would_reject(client, sent_emails, weak):
    payload = _verified_account(client, sent_emails)
    token = _reset_token_for(client, sent_emails, payload)

    response = client.post(
        "/accounts/password-reset/confirm",
        json={"token": token, "new_password": weak},
    )

    assert response.status_code == 422
    assert _login(client, payload["email"], payload["password"]).status_code == 200


def test_request_endpoint_is_rate_limited(client):
    statuses = [
        _request_reset(client, "flooder@example.com").status_code for _ in range(6)
    ]
    assert 429 in statuses


def test_confirm_endpoint_is_rate_limited(client):
    statuses = [
        client.post(
            "/accounts/password-reset/confirm",
            json={"token": "guess", "new_password": NEW_PASSWORD},
        ).status_code
        for _ in range(12)
    ]
    assert 429 in statuses
