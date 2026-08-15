"""Admin authorisation, the analytics it serves, and admin creation.

The security half of this module is the important half. The dashboard is meant to be invisible to
anyone who is not an admin, and "invisible" has a precise meaning here: every admin route answers
exactly what a route that does not exist answers, byte for byte, to an anonymous caller and to a
signed-in ordinary user alike. Several tests below exist only to keep that true.
"""

import datetime as dt

from src.analytics import CATALOGUE, CATALOGUE_BY_NAME
from src.database.models import Account, SurveyResponse
from src.enums import AccountType, Genre, TicketPriceRange
from tests.helpers import SURVEY_PAYLOAD, get_account, signup

# Every admin route, so a new one cannot be added without being covered by the masking tests.
ADMIN_ROUTES = [
    ("GET", "/admin/session"),
    ("GET", "/admin/analytics/schema"),
    ("GET", "/admin/analytics/overview"),
    ("GET", "/admin/analytics/breakdown"),
    ("GET", "/admin/accounts"),
    ("POST", "/admin/accounts"),
    ("POST", "/admin/accounts/promote"),
    ("GET", "/admin/accounts/lookup?reference=abcd"),
]

NEW_ADMIN = {
    "email": "second-admin@example.com",
    "phone": "+306999000111",
    "password": "another-strong-password",
}


def _verified_account(client, sent_emails, **overrides) -> dict[str, str]:
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
    assert response.status_code == 200, response.text


def _make_admin(db_session, email: str) -> Account:
    account = get_account(db_session, email)
    assert account is not None
    account.role = AccountType.ADMIN
    db_session.commit()
    return account


def _signed_in_admin(client, sent_emails, db_session, **overrides) -> dict[str, str]:
    """A verified admin with a live session cookie on `client`."""
    payload = _verified_account(client, sent_emails, **overrides)
    _make_admin(db_session, payload["email"])
    _login(client, payload)
    return payload


def _call(client, method: str, path: str):
    if method == "POST":
        return client.post(path, json=NEW_ADMIN)
    return client.get(path)


# --- The dashboard is hidden, not merely forbidden ------------------------------------------------


def test_every_admin_route_is_404_to_an_anonymous_caller(client):
    for method, path in ADMIN_ROUTES:
        response = _call(client, method, path)
        assert response.status_code == 404, f"{method} {path} leaked {response.status_code}"


def test_admin_routes_are_indistinguishable_from_a_route_that_does_not_exist(client):
    """A different status or body would confirm the dashboard exists, which is the thing to hide."""
    missing = client.get("/no-such-route-at-all")

    for method, path in ADMIN_ROUTES:
        response = _call(client, method, path)
        assert response.status_code == missing.status_code
        assert response.json() == missing.json()


def test_an_ordinary_user_gets_404_not_403(client, sent_emails, db_session):
    """A 403 would tell a signed-in user there is an admin area they are being kept out of."""
    payload = _verified_account(client, sent_emails)
    _login(client, payload)

    account = get_account(db_session, payload["email"])
    assert account is not None and account.role == AccountType.USER

    for method, path in ADMIN_ROUTES:
        response = _call(client, method, path)
        assert response.status_code == 404, f"{method} {path} leaked {response.status_code}"


def test_an_unverified_admin_cannot_reach_the_dashboard(client, sent_emails, db_session):
    """Being promoted is not enough; the email still has to be proven, exactly like login demands."""
    _code, payload = signup(client, sent_emails)
    account = get_account(db_session, payload["email"])
    assert account is not None
    account.role = AccountType.ADMIN
    db_session.commit()

    # No login is even possible while unverified, so mint the session directly — this is the
    # strongest form of the case: a valid token for a real admin account that is not yet verified.
    from src.auth import AUTH_COOKIE_NAME, create_access_token

    client.cookies.set(AUTH_COOKIE_NAME, create_access_token(account.id, dt.timedelta(minutes=5)))

    assert client.get("/admin/session").status_code == 404


def test_an_expired_session_gets_the_same_404(client, sent_emails, db_session):
    from src.auth import AUTH_COOKIE_NAME, create_access_token

    payload = _verified_account(client, sent_emails)
    account = _make_admin(db_session, payload["email"])

    client.cookies.set(
        AUTH_COOKIE_NAME, create_access_token(account.id, dt.timedelta(minutes=-5))
    )

    assert client.get("/admin/session").status_code == 404


def test_a_qr_credential_cannot_open_the_dashboard(client, sent_emails, db_session):
    """The redemption token names the same account and is signed with the same key. Its scope is
    what stops it acting as a session, and that has to hold for the admin routes too."""
    from src.auth import AUTH_COOKIE_NAME
    from src.redemption import create_redemption_token

    payload = _signed_in_admin(client, sent_emails, db_session)
    account = get_account(db_session, payload["email"])
    assert account is not None

    client.cookies.set(AUTH_COOKIE_NAME, create_redemption_token(account))

    assert client.get("/admin/session").status_code == 404


def test_an_admin_reaches_the_dashboard(client, sent_emails, db_session):
    _signed_in_admin(client, sent_emails, db_session)

    response = client.get("/admin/session")

    assert response.status_code == 200
    assert response.json() == {"role": "admin", "reference": response.json()["reference"]}
    assert response.json()["role"] == "admin"


def test_bearer_tokens_work_for_admins_too(client, sent_emails, db_session):
    """The dashboard adds no new way to authenticate — the ordinary session token is the credential."""
    payload = _verified_account(client, sent_emails)
    _make_admin(db_session, payload["email"])

    login = client.post(
        "/accounts/login", json={"email": payload["email"], "password": payload["password"]}
    )
    token = login.json()["access_token"]
    client.cookies.clear()

    response = client.get("/admin/session", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200


# --- No self-promotion ----------------------------------------------------------------------------


def test_a_user_cannot_create_an_admin(client, sent_emails, db_session):
    payload = _verified_account(client, sent_emails)
    _login(client, payload)

    response = client.post("/admin/accounts", json=NEW_ADMIN)

    assert response.status_code == 404
    # The refusal must also not have created anything on the way past.
    assert get_account(db_session, NEW_ADMIN["email"]) is None


def test_signup_cannot_ask_for_a_role(client, sent_emails, db_session):
    """`role` is not a field on any request model, so sending one is simply ignored."""
    signup(client, sent_emails, email="sneaky@example.com")

    account = get_account(db_session, "sneaky@example.com")
    assert account is not None
    assert account.role == AccountType.USER


def test_a_user_cannot_promote_itself_through_the_profile(client, sent_emails, db_session):
    payload = _verified_account(client, sent_emails)
    _login(client, payload)

    # There is no endpoint that writes `role`; the closest thing to try is the profile.
    client.get("/accounts/me?role=admin")

    account = get_account(db_session, payload["email"])
    assert account is not None
    assert account.role == AccountType.USER


def test_an_admin_can_create_another_admin(client, sent_emails, db_session):
    _signed_in_admin(client, sent_emails, db_session)

    response = client.post("/admin/accounts", json=NEW_ADMIN)

    assert response.status_code == 201, response.text

    created = get_account(db_session, NEW_ADMIN["email"])
    assert created is not None
    assert created.role == AccountType.ADMIN
    # Created but inert: it cannot sign in until the emailed code is entered, like every account.
    assert created.email_verified_at is None

    login = client.post(
        "/accounts/login",
        json={"email": NEW_ADMIN["email"], "password": NEW_ADMIN["password"]},
    )
    assert login.status_code == 403


def test_a_created_admin_becomes_usable_after_verifying(client, sent_emails, db_session):
    _signed_in_admin(client, sent_emails, db_session)
    client.post("/admin/accounts", json=NEW_ADMIN)

    from tests.helpers import code_from_email

    code = code_from_email(sent_emails[-1])
    assert (
        client.post(
            "/accounts/verify-email", json={"email": NEW_ADMIN["email"], "code": code}
        ).status_code
        == 200
    )

    client.cookies.clear()
    _login(client, NEW_ADMIN)
    assert client.get("/admin/session").status_code == 200


def test_creating_an_admin_rejects_a_duplicate(client, sent_emails, db_session):
    admin_payload = _signed_in_admin(client, sent_emails, db_session)

    response = client.post(
        "/admin/accounts",
        json={**NEW_ADMIN, "email": admin_payload["email"]},
    )

    assert response.status_code == 409
    # The existing admin is untouched — a collision must never overwrite an account.
    existing = get_account(db_session, admin_payload["email"])
    assert existing is not None
    assert existing.email_verified_at is not None


# --- Promoting an existing account ------------------------------------------------------------------


def test_a_user_cannot_promote_anyone(client, sent_emails, db_session):
    """Including themselves — the endpoint is unreachable, so the role never changes."""
    payload = _verified_account(client, sent_emails)
    _login(client, payload)

    response = client.post("/admin/accounts/promote", json={"email": payload["email"]})

    assert response.status_code == 404
    account = get_account(db_session, payload["email"])
    assert account is not None
    assert account.role == AccountType.USER


def test_an_admin_can_promote_a_verified_account(client, sent_emails, db_session):
    _signed_in_admin(client, sent_emails, db_session)
    target = _verified_account(
        client, sent_emails, email="promote-me@example.com", phone="+306933333333"
    )

    response = client.post("/admin/accounts/promote", json={"email": target["email"]})

    assert response.status_code == 200, response.text

    account = get_account(db_session, target["email"])
    assert account is not None
    db_session.refresh(account)
    assert account.role == AccountType.ADMIN
    # The reference is the only confirmation the caller gets that the right account was hit.
    assert response.json()["reference"] == account.id.split("-")[0].upper()


def test_a_promoted_account_reaches_the_dashboard_on_its_existing_session(
    client, sent_emails, db_session
):
    """The role is read from the database on every request, so an already-signed-in account gains
    access without having to sign in again."""
    from src.auth import AUTH_COOKIE_NAME

    _signed_in_admin(client, sent_emails, db_session)
    target = _verified_account(
        client, sent_emails, email="promote-me@example.com", phone="+306933333333"
    )

    admin_cookie = client.cookies.get(AUTH_COOKIE_NAME)

    # Sign the target in first, and confirm the dashboard is hidden from them.
    client.cookies.clear()
    _login(client, target)
    target_cookie = client.cookies.get(AUTH_COOKIE_NAME)
    assert client.get("/admin/session").status_code == 404

    client.cookies.set(AUTH_COOKIE_NAME, admin_cookie)
    assert (
        client.post(
            "/admin/accounts/promote", json={"email": target["email"]}
        ).status_code
        == 200
    )

    # Same token as before the promotion.
    client.cookies.set(AUTH_COOKIE_NAME, target_cookie)
    assert client.get("/admin/session").status_code == 200


def test_promotion_matches_the_address_through_the_stored_hash(
    client, sent_emails, db_session
):
    """Nothing readable is stored, so the lookup is `hash_identifier(email) == email_hash`. The
    same normalisation signup used has to apply, or a valid address would miss its own account."""
    from src.auth import hash_identifier

    _signed_in_admin(client, sent_emails, db_session)
    target = _verified_account(
        client, sent_emails, email="promote-me@example.com", phone="+306933333333"
    )

    account = get_account(db_session, target["email"])
    assert account is not None
    assert account.email_hash == hash_identifier(target["email"])

    # Case and surrounding whitespace are normalised away by hash_identifier, so this is the same
    # account as far as the lookup is concerned.
    response = client.post("/admin/accounts/promote", json={"email": "  Promote-Me@Example.com  "})

    assert response.status_code == 200
    assert response.json()["reference"] == account.id.split("-")[0].upper()


def test_promoting_an_unknown_address_is_not_a_404(client, sent_emails, db_session):
    """A 404 on this router means "you are not an admin" and sends the dashboard to its masked
    not-found screen. A mistyped address must not look like a lost session."""
    _signed_in_admin(client, sent_emails, db_session)

    response = client.post("/admin/accounts/promote", json={"email": "nobody@example.com"})

    assert response.status_code == 422
    assert "No account" in response.json()["detail"]


def test_promoting_an_unverified_account_is_refused(client, sent_emails, db_session):
    """Login refuses an unverified account, so promoting one would mint an admin who cannot sign
    in and no explanation of why."""
    _signed_in_admin(client, sent_emails, db_session)
    _code, target = signup(
        client, sent_emails, email="pending@example.com", phone="+306944444444"
    )

    response = client.post("/admin/accounts/promote", json={"email": target["email"]})

    assert response.status_code == 422
    account = get_account(db_session, target["email"])
    assert account is not None
    assert account.role == AccountType.USER


def test_promoting_an_existing_admin_is_reported_not_silently_repeated(
    client, sent_emails, db_session
):
    admin_payload = _signed_in_admin(client, sent_emails, db_session)

    response = client.post("/admin/accounts/promote", json={"email": admin_payload["email"]})

    assert response.status_code == 409


def test_promotion_changes_nothing_but_the_role(client, sent_emails, db_session):
    """It must not touch verification, voting or the door pass on the way past."""
    _signed_in_admin(client, sent_emails, db_session)
    target = _verified_account(
        client, sent_emails, email="promote-me@example.com", phone="+306933333333"
    )

    before = get_account(db_session, target["email"])
    assert before is not None
    snapshot = (
        before.email_hash,
        before.phone_hash,
        before.hashed_password,
        before.email_verified_at,
        before.has_voted,
        before.allowed_to_redeem,
        before.has_redeemed,
        before.created_at,
    )

    assert (
        client.post("/admin/accounts/promote", json={"email": target["email"]}).status_code == 200
    )

    after = get_account(db_session, target["email"])
    assert after is not None
    db_session.refresh(after)
    assert (
        after.email_hash,
        after.phone_hash,
        after.hashed_password,
        after.email_verified_at,
        after.has_voted,
        after.allowed_to_redeem,
        after.has_redeemed,
        after.created_at,
    ) == snapshot
    assert after.role == AccountType.ADMIN


def test_promotion_creates_no_account(client, sent_emails, db_session):
    """The distinction from POST /admin/accounts: this one only ever edits a row that exists."""
    _signed_in_admin(client, sent_emails, db_session)
    before = db_session.query(Account).count()

    client.post("/admin/accounts/promote", json={"email": "nobody@example.com"})

    assert db_session.query(Account).count() == before


# --- Account lookup (the redemption fallback) -----------------------------------------------------


def test_lookup_finds_an_account_by_its_full_reference(client, sent_emails, db_session):
    _signed_in_admin(client, sent_emails, db_session)
    target = _verified_account(client, sent_emails, email="finder@example.com", phone="+306955550000")
    account = get_account(db_session, target["email"])
    assert account is not None
    account.has_voted = True
    account.allowed_to_redeem = True
    account.has_redeemed = True
    account.redeemed_at = account.created_at
    db_session.commit()

    reference = account.id.split("-")[0]
    body = client.get(f"/admin/accounts/lookup?reference={reference}").json()

    assert body["count"] == 1
    hit = body["results"][0]
    assert hit["account_id"] == account.id
    assert hit["reference"] == reference.upper()
    assert hit["has_voted"] is True
    assert hit["email_verified"] is True
    assert hit["has_redeemed"] is True
    assert hit["redeemed_at"] is not None


def test_lookup_is_case_insensitive_like_the_displayed_reference(client, sent_emails, db_session):
    """The profile shows the reference upper-cased; searching with it must still hit the row."""
    _signed_in_admin(client, sent_emails, db_session)
    target = _verified_account(client, sent_emails, email="caps@example.com", phone="+306955551111")
    account = get_account(db_session, target["email"])
    assert account is not None

    displayed = account.id.split("-")[0].upper()
    body = client.get(f"/admin/accounts/lookup?reference={displayed}").json()

    assert [r["account_id"] for r in body["results"]] == [account.id]


def test_lookup_matches_a_prefix(client, sent_emails, db_session):
    _signed_in_admin(client, sent_emails, db_session)
    target = _verified_account(client, sent_emails, email="prefix@example.com", phone="+306955552222")
    account = get_account(db_session, target["email"])
    assert account is not None

    prefix = account.id[:4]
    body = client.get(f"/admin/accounts/lookup?reference={prefix}").json()

    assert account.id in [r["account_id"] for r in body["results"]]
    assert all(r["account_id"].startswith(prefix.lower()) for r in body["results"])


def test_lookup_rejects_a_too_short_term(client, sent_emails, db_session):
    """One character (or none) is refused, so a stray keystroke does not pull the whole table."""
    _signed_in_admin(client, sent_emails, db_session)

    assert client.get("/admin/accounts/lookup?reference=a").status_code == 422
    assert client.get("/admin/accounts/lookup?reference=").status_code == 422


def test_lookup_rejects_like_wildcards_and_injection(client, sent_emails, db_session):
    """The term is validated to hex+dashes, so LIKE wildcards and SQL metacharacters never reach the
    query — a '%' would otherwise match everything, and quotes could probe for injection."""
    _signed_in_admin(client, sent_emails, db_session)

    for bad in ["%25", "5%25", "a_b", "a'b", "a;b", "a b"]:
        assert client.get(f"/admin/accounts/lookup?reference={bad}").status_code == 422


def test_lookup_exposes_no_hashes(client, sent_emails, db_session):
    _signed_in_admin(client, sent_emails, db_session)
    target = _verified_account(client, sent_emails, email="clean@example.com", phone="+306955553333")
    account = get_account(db_session, target["email"])
    assert account is not None

    text = client.get(f"/admin/accounts/lookup?reference={account.id[:8]}").text

    assert "email_hash" not in text
    assert "phone_hash" not in text
    assert "hashed_password" not in text


def test_lookup_reports_no_match_without_erroring(client, sent_emails, db_session):
    _signed_in_admin(client, sent_emails, db_session)

    body = client.get("/admin/accounts/lookup?reference=ffffffff").json()

    assert body["count"] == 0
    assert body["truncated"] is False
    assert body["results"] == []


# --- The catalogue is derived, not written down ---------------------------------------------------


def test_the_schema_endpoint_matches_the_survey_model(client, sent_emails, db_session):
    """If this drifts, the dashboard is offering filters the API would reject, or missing options
    the survey accepts."""
    _signed_in_admin(client, sent_emails, db_session)

    body = client.get("/admin/analytics/schema").json()

    assert [field["name"] for field in body["fields"]] == [field.name for field in CATALOGUE]
    for field in body["fields"]:
        assert field["values"] == list(CATALOGUE_BY_NAME[field["name"]].values)


def test_the_catalogue_follows_the_enums(client, sent_emails, db_session):
    """Spot check against the enums themselves rather than against a copied list."""
    _signed_in_admin(client, sent_emails, db_session)

    body = client.get("/admin/analytics/schema").json()
    fields = {field["name"]: field for field in body["fields"]}

    assert fields["genre_preferences"]["values"] == [member.value for member in Genre]
    assert fields["genre_preferences"]["kind"] == "multi"
    assert fields["ticket_price_range"]["values"] == [m.value for m in TicketPriceRange]
    # Scale bounds come from the pydantic constraint, not from a number typed into the analytics.
    assert fields["interest_level"] == {
        "name": "interest_level",
        "kind": "scale",
        "values": [],
        "optional": False,
        "filterable": False,
        "minimum": 1,
        "maximum": 10,
    }
    # Free text is charted by nobody.
    assert "open_feedback" not in fields
    assert "accommodation_area" not in fields


def test_the_survey_rejects_a_category_outside_the_enums(client, sent_emails):
    """The other half of "one source of truth": the API will not store what the dashboard cannot
    report on."""
    payload = _verified_account(client, sent_emails)
    _login(client, payload)

    response = client.post(
        "/surveys/submit", json={**SURVEY_PAYLOAD, "ticket_price_range": "1000-2000"}
    )

    assert response.status_code == 422


# --- Counting ---------------------------------------------------------------------------------------


def _add_response(db_session, submitted_at: dt.datetime, **overrides) -> None:
    """Insert a survey response directly, so its timestamp can be placed in the past."""
    body = {**SURVEY_PAYLOAD, **overrides}
    body.pop("open_feedback", None)
    db_session.add(SurveyResponse(**body, submitted_at=submitted_at))
    db_session.commit()


def test_overview_counts_surveys_from_submissions_not_accounts(
    client, sent_emails, db_session
):
    _signed_in_admin(client, sent_emails, db_session)
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)

    _add_response(db_session, now - dt.timedelta(hours=1))
    _add_response(db_session, now - dt.timedelta(hours=2))

    totals = client.get("/admin/analytics/overview?window=24h").json()["totals"]

    # One account exists (the admin) and it has not voted; two responses are stored.
    assert totals["accounts"] == 1
    assert totals["surveys"] == 2
    assert totals["voted_accounts"] == 0


def test_voted_percentage_is_of_the_whole_user_base(client, sent_emails, db_session):
    _signed_in_admin(client, sent_emails, db_session)
    voter = _verified_account(client, sent_emails, email="voter@example.com", phone="+306911111111")
    _verified_account(client, sent_emails, email="quiet@example.com", phone="+306922222222")

    account = get_account(db_session, voter["email"])
    assert account is not None
    account.has_voted = True
    db_session.commit()

    totals = client.get("/admin/analytics/overview?window=7d").json()["totals"]

    assert totals["accounts"] == 3
    assert totals["voted_accounts"] == 1
    assert totals["voted_percentage"] == 33.3


def test_the_window_is_a_rolling_period_from_now(client, sent_emails, db_session):
    _signed_in_admin(client, sent_emails, db_session)
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)

    _add_response(db_session, now - dt.timedelta(hours=2))
    _add_response(db_session, now - dt.timedelta(days=2))
    _add_response(db_session, now - dt.timedelta(days=5))
    _add_response(db_session, now - dt.timedelta(days=30))

    day = client.get("/admin/analytics/overview?window=24h").json()
    three = client.get("/admin/analytics/overview?window=3d").json()
    week = client.get("/admin/analytics/overview?window=7d").json()

    assert day["surveys_in_window"] == 1
    assert three["surveys_in_window"] == 2
    assert week["surveys_in_window"] == 3
    # All four are still counted in the platform total, which is never windowed.
    assert week["totals"]["surveys"] == 4


def test_the_series_starts_from_the_existing_platform_size(client, sent_emails, db_session):
    """The cumulative line has to begin at what already existed, not at zero."""
    _signed_in_admin(client, sent_emails, db_session)
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)

    _add_response(db_session, now - dt.timedelta(days=30))
    _add_response(db_session, now - dt.timedelta(hours=1))

    series = client.get("/admin/analytics/overview?window=24h").json()["series"]

    assert series[0]["surveys_cumulative"] == 1
    assert series[-1]["surveys_cumulative"] == 2


def test_an_unknown_window_is_rejected(client, sent_emails, db_session):
    _signed_in_admin(client, sent_emails, db_session)

    assert client.get("/admin/analytics/overview?window=all").status_code == 422
    assert client.get("/admin/analytics/overview?window=99d").status_code == 422


# --- Distributions and filters ----------------------------------------------------------------------


def test_declared_options_appear_even_with_no_takers(client, sent_emails, db_session):
    """An option nobody picked is a result, and dropping it would quietly rewrite the question."""
    _signed_in_admin(client, sent_emails, db_session)
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
    _add_response(db_session, now, ticket_price_range="10-20")

    body = client.get("/admin/analytics/breakdown").json()
    prices = next(d for d in body["distributions"] if d["field"] == "ticket_price_range")

    assert [bucket["value"] for bucket in prices["buckets"]] == [m.value for m in TicketPriceRange]
    assert {b["value"]: b["count"] for b in prices["buckets"]}["over_40"] == 0


def test_a_multi_select_counts_each_choice(client, sent_emails, db_session):
    _signed_in_admin(client, sent_emails, db_session)
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)

    _add_response(db_session, now, genre_preferences=["rock", "techno"])
    _add_response(db_session, now, genre_preferences=["rock"])

    body = client.get("/admin/analytics/breakdown").json()
    genres = next(d for d in body["distributions"] if d["field"] == "genre_preferences")
    counts = {bucket["value"]: bucket["count"] for bucket in genres["buckets"]}

    assert counts["rock"] == 2
    assert counts["techno"] == 1
    assert counts["house"] == 0
    # Two respondents, three selections — the denominator is respondents, not selections.
    assert genres["respondents"] == 2


def test_a_skipped_optional_answer_is_counted_separately(client, sent_emails, db_session):
    _signed_in_admin(client, sent_emails, db_session)
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)

    _add_response(db_session, now, age_range="18-20")
    _add_response(db_session, now, age_range=None)

    body = client.get("/admin/analytics/breakdown").json()
    ages = next(d for d in body["distributions"] if d["field"] == "age_range")

    assert ages["unanswered"] == 1
    assert ages["respondents"] == 1


def test_a_scale_reports_its_average(client, sent_emails, db_session):
    _signed_in_admin(client, sent_emails, db_session)
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)

    _add_response(db_session, now, interest_level=2)
    _add_response(db_session, now, interest_level=8)

    body = client.get("/admin/analytics/breakdown").json()
    interest = next(d for d in body["distributions"] if d["field"] == "interest_level")

    assert interest["average"] == 5.0
    assert [b["value"] for b in interest["buckets"]] == [str(n) for n in range(1, 11)]
    assert {b["value"]: b["count"] for b in interest["buckets"]}["8"] == 1


def test_filters_and_within_fields_or_across_values(client, sent_emails, db_session):
    _signed_in_admin(client, sent_emails, db_session)
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)

    _add_response(db_session, now, audience_type="student", age_range="18-20", has_student_pass=True)
    _add_response(db_session, now, audience_type="student", age_range="25-29", has_student_pass=True)
    _add_response(db_session, now, audience_type="local", age_range="18-20")

    both_ages = client.get(
        "/admin/analytics/breakdown?age_range=18-20&age_range=25-29"
    ).json()
    assert both_ages["matched"] == 3

    narrowed = client.get(
        "/admin/analytics/breakdown?age_range=18-20&audience_type=student"
    ).json()
    assert narrowed["matched"] == 1
    assert narrowed["total"] == 3


def test_a_multi_select_filter_matches_any_choice(client, sent_emails, db_session):
    _signed_in_admin(client, sent_emails, db_session)
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)

    _add_response(db_session, now, genre_preferences=["rock", "techno"])
    _add_response(db_session, now, genre_preferences=["laiko"])

    body = client.get("/admin/analytics/breakdown?genre_preferences=techno").json()

    assert body["matched"] == 1


def test_an_unknown_filter_is_rejected_rather_than_ignored(client, sent_emails, db_session):
    """Silently dropping it would show a filtered-looking chart that was not actually filtered."""
    _signed_in_admin(client, sent_emails, db_session)

    assert client.get("/admin/analytics/breakdown?not_a_field=x").status_code == 422
    assert client.get("/admin/analytics/breakdown?age_range=99-100").status_code == 422
    # Scales are charted but not filterable, and asking to filter one is still a mistake.
    assert client.get("/admin/analytics/breakdown?interest_level=5").status_code == 422


def test_the_breakdown_can_be_windowed(client, sent_emails, db_session):
    _signed_in_admin(client, sent_emails, db_session)
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)

    _add_response(db_session, now - dt.timedelta(hours=1))
    _add_response(db_session, now - dt.timedelta(days=4))

    assert client.get("/admin/analytics/breakdown").json()["total"] == 2
    assert client.get("/admin/analytics/breakdown?window=24h").json()["total"] == 1


# --- The analytics stays anonymous -------------------------------------------------------------------


def test_no_admin_response_carries_an_account_identifier(client, sent_emails, db_session):
    """Aggregates only. A response is not linked to an account in the database, and nothing here
    may reintroduce a link by returning rows."""
    _signed_in_admin(client, sent_emails, db_session)
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
    _add_response(db_session, now, open_feedback="Please book a specific artist.")

    bodies = [
        client.get("/admin/analytics/overview?window=7d").text,
        client.get("/admin/analytics/breakdown").text,
        client.get("/admin/accounts").text,
    ]

    for body in bodies:
        assert "email_hash" not in body
        assert "phone_hash" not in body
        assert "hashed_password" not in body
        # Free text is never aggregated, so it cannot be read back through the dashboard.
        assert "specific artist" not in body


def test_the_admin_list_shows_references_only(client, sent_emails, db_session):
    payload = _signed_in_admin(client, sent_emails, db_session)
    account = get_account(db_session, payload["email"])
    assert account is not None

    body = client.get("/admin/accounts").json()

    assert len(body) == 1
    assert body[0]["reference"] == account.id.split("-")[0].upper()
    assert body[0]["is_self"] is True
    assert set(body[0]) == {"reference", "created_at", "email_verified", "is_self"}
    # The full account id is a database key; only the leading segment is quotable.
    assert account.id not in client.get("/admin/accounts").text
