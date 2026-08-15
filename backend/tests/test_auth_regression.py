"""Guards the authentication behaviour that existed before email verification was added."""

import datetime as dt

from src.auth import (
    DUMMY_HASH,
    create_access_token,
    get_password_hash,
    hash_identifier,
    verify_password,
)
from tests.helpers import SURVEY_PAYLOAD, VALID_SIGNUP, get_account, signup


def _verified_login(client, sent_emails) -> tuple[str, dict[str, str]]:
    code, payload = signup(client, sent_emails)
    client.post("/accounts/verify-email", json={"email": payload["email"], "code": code})
    response = client.post(
        "/accounts/login", json={"email": payload["email"], "password": payload["password"]}
    )
    assert response.status_code == 200
    return response.json()["access_token"], payload


def test_password_hashing_is_unchanged(client):
    hashed = get_password_hash("correct-horse-battery")

    assert hashed != "correct-horse-battery"
    assert verify_password("correct-horse-battery", hashed)
    assert not verify_password("wrong-password", hashed)
    assert not verify_password("anything", DUMMY_HASH)


def test_identifier_hashing_is_unchanged(client):
    assert hash_identifier("Person@Example.com ") == hash_identifier("person@example.com")
    assert hash_identifier("a@b.com") != hash_identifier("c@d.com")
    assert len(hash_identifier("a@b.com")) == 64


def test_login_with_wrong_password_still_returns_401(client, sent_emails):
    _token, payload = _verified_login(client, sent_emails)

    response = client.post(
        "/accounts/login", json={"email": payload["email"], "password": "not-the-password"}
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_login_for_unknown_account_still_returns_401(client):
    response = client.post(
        "/accounts/login", json={"email": "nobody@example.com", "password": "irrelevant"}
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_protected_endpoint_requires_a_token(client):
    assert client.get("/accounts/me/has-voted").status_code == 401


def test_protected_endpoint_rejects_a_bad_token(client):
    response = client.get(
        "/accounts/me/has-voted", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code == 401


def test_expired_token_is_rejected(client, sent_emails, db_session):
    _code, payload = signup(client, sent_emails)
    account = get_account(db_session, payload["email"])
    expired = create_access_token(account.id, dt.timedelta(minutes=-1))

    response = client.get(
        "/accounts/me/has-voted", headers={"Authorization": f"Bearer {expired}"}
    )

    assert response.status_code == 401


def test_has_voted_still_works_for_a_verified_account(client, sent_emails):
    token, _payload = _verified_login(client, sent_emails)

    response = client.get(
        "/accounts/me/has-voted", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.json() is False


def test_survey_submission_still_works_end_to_end(client, sent_emails):
    token, _payload = _verified_login(client, sent_emails)
    headers = {"Authorization": f"Bearer {token}"}

    submitted = client.post("/surveys/submit", json=SURVEY_PAYLOAD, headers=headers)
    assert submitted.status_code == 201

    assert client.get("/accounts/me/has-voted", headers=headers).json() is True

    # The one-response-per-account rule is unaffected.
    duplicate = client.post("/surveys/submit", json=SURVEY_PAYLOAD, headers=headers)
    assert duplicate.status_code == 409


def test_a_rejected_resubmission_writes_no_second_response(client, sent_emails, db_session):
    """The anti-revote guard is an atomic conditional UPDATE, not a read-then-write.

    A duplicate submission must be turned away *and* leave no trace: the guarded UPDATE matches zero
    rows the second time, so the handler rolls back before inserting. If it ever regressed to
    checking a flag and then writing regardless, this would catch the extra row even though the
    single-threaded test client cannot reproduce the underlying race directly.
    """
    from src.database.models import SurveyResponse

    token, _payload = _verified_login(client, sent_emails)
    headers = {"Authorization": f"Bearer {token}"}

    assert client.post("/surveys/submit", json=SURVEY_PAYLOAD, headers=headers).status_code == 201
    assert client.post("/surveys/submit", json=SURVEY_PAYLOAD, headers=headers).status_code == 409
    assert client.post("/surveys/submit", json=SURVEY_PAYLOAD, headers=headers).status_code == 409

    # Exactly one row, however many times submit was called.
    assert db_session.query(SurveyResponse).count() == 1


def test_survey_validation_is_unchanged(client, sent_emails):
    token, _payload = _verified_login(client, sent_emails)

    # Tourists must declare transport_interest — an existing model_validator rule.
    response = client.post(
        "/surveys/submit",
        json={**SURVEY_PAYLOAD, "audience_type": "tourist", "transport_interest": None},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


def test_health_endpoint_still_responds(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_unique_phone_constraint_still_applies(client, sent_emails, db_session):
    """A verified account's phone number stays reserved against a different email."""
    code, payload = signup(client, sent_emails)
    client.post("/accounts/verify-email", json={"email": payload["email"], "code": code})

    before = len(sent_emails)
    client.post(
        "/accounts/signup",
        json={**VALID_SIGNUP, "email": "someone-else@example.com"},
    )

    # No account created and no code issued for the duplicate phone number.
    assert get_account(db_session, "someone-else@example.com") is None
    assert len(sent_emails) == before
