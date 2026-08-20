"""Transactional email delivery through Resend.

Talks to the Resend HTTP API directly with ``httpx`` (already a dependency of ``fastapi[standard]``)
rather than pulling in another SDK.

The API key is read from the environment and nowhere else. Nothing in this module logs the key, the
verification code, or the recipient address — failures are reported by status code only.
"""

import html
import logging
import os
import re

import httpx

logger = logging.getLogger(__name__)

# Anything shaped like an address, so a rejection reason can be logged without the recipient's
# email going into the logs along with it.
_ADDRESS = re.compile(r"[^\s<>@,;]+@[^\s<>@,;]+")

RESEND_API_URL = "https://api.resend.com/emails"
REQUEST_TIMEOUT_SECONDS = 10.0

APP_NAME = os.getenv("APP_NAME", "Culture Fest")


def _api_key() -> str | None:
    # Read per call rather than at import: keeps the module importable (and testable) without the
    # key set, and picks up the value in the reloading dev container.
    return os.getenv("RESEND_API_KEY")


def _from_address() -> str | None:
    return os.getenv("EMAIL_FROM")


def _rejection_reason(response: httpx.Response) -> str:
    """Why Resend refused a send, with any email address removed.

    Resend reports errors as ``{"name": ..., "message": ...}``. Both are about the request rather
    than the person, which is what makes them safe to log once addresses are scrubbed — the message
    for an unverified sender, for instance, names the domain and nothing else.
    """
    try:
        body = response.json()
    except ValueError:
        return ""

    if not isinstance(body, dict):
        return ""

    parts = [str(body[key]) for key in ("name", "message") if body.get(key)]
    return _ADDRESS.sub("<address>", " — ".join(parts)) if parts else ""


def _send(to: str, subject: str, html_body: str, text_body: str) -> None:
    """POST one email to Resend. Never raises — a failed send must not break the request flow."""
    api_key = _api_key()
    from_address = _from_address()

    if not api_key or not from_address:
        logger.warning(
            "Email not sent: RESEND_API_KEY and EMAIL_FROM must both be set in the environment"
        )
        return

    try:
        response = httpx.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "from": from_address,
                "to": [to],
                "subject": subject,
                "html": html_body,
                "text": text_body,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        if response.status_code >= 400:
            # The reason matters: the failures that actually happen here are configuration, not
            # transient — an unverified sending domain, a revoked key — and every one of them is
            # invisible from the outside, because a failed send still leaves signup answering 202.
            # Without this, the only symptom is users reporting that no code ever arrived.
            #
            # Resend's body can echo the recipient back, so addresses are stripped before logging;
            # what survives is the part that names the problem.
            logger.error(
                "Resend rejected an email with status %s%s",
                response.status_code,
                f": {reason}" if (reason := _rejection_reason(response)) else "",
            )
    except httpx.HTTPError as exc:
        logger.error("Email delivery failed: %s", type(exc).__name__)


def _layout(heading: str, body_html: str) -> str:
    """Shared responsive shell. Inline styles only — email clients strip <style> blocks."""
    return f"""\
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#171717;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid rgba(0,0,0,0.08);">
      <tr>
        <td style="padding:32px 24px;">
          <p style="margin:0 0 24px;font-size:14px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#71717a;">{html.escape(APP_NAME)}</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:600;color:#171717;">{html.escape(heading)}</h1>
          {body_html}
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def send_verification_email(to: str, code: str, expires_in_minutes: int) -> None:
    """Deliver a verification code. Called from a background task, so it must not raise."""
    heading = "Confirm your email address"

    body_html = f"""\
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">
            Enter this code to finish creating your {html.escape(APP_NAME)} account:
          </p>
          <p style="margin:0 0 24px;padding:16px;text-align:center;background:rgba(0,0,0,0.04);border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:600;letter-spacing:0.25em;color:#171717;">
            {html.escape(code)}
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f3f46;">
            This code expires in {expires_in_minutes} minutes and can only be used once.
          </p>
          <p style="margin:0;padding-top:20px;border-top:1px solid rgba(0,0,0,0.08);font-size:13px;line-height:1.6;color:#71717a;">
            If you did not sign up for {html.escape(APP_NAME)}, you can safely ignore this email —
            no account will be created without this code, and nobody else can complete the signup
            without it.
          </p>
"""

    text_body = (
        f"{APP_NAME}\n\n"
        "Confirm your email address\n\n"
        f"Enter this code to finish creating your {APP_NAME} account:\n\n"
        f"    {code}\n\n"
        f"This code expires in {expires_in_minutes} minutes and can only be used once.\n\n"
        f"If you did not sign up for {APP_NAME}, you can safely ignore this email — no account "
        "will be created without this code.\n"
    )

    _send(
        to=to,
        subject=f"{APP_NAME}: your verification code",
        html_body=_layout(heading, body_html),
        text_body=text_body,
    )


def send_account_exists_email(to: str) -> None:
    """Sent instead of a code when a verified account already owns the address.

    The signup endpoint answers identically whether or not an account exists, so this email is what
    keeps that generic response from being a dead end for the real account holder.
    """
    heading = "You already have an account"

    body_html = f"""\
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">
            Someone just tried to sign up for {html.escape(APP_NAME)} with this email address, but
            an account already exists for it. No new account was created and nothing has changed.
          </p>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">
            If that was you, sign in with your existing account instead.
          </p>
          <p style="margin:0;padding-top:20px;border-top:1px solid rgba(0,0,0,0.08);font-size:13px;line-height:1.6;color:#71717a;">
            If it was not you, you can safely ignore this email. Your account is unaffected — but if
            you are concerned, consider changing your password.
          </p>
"""

    text_body = (
        f"{APP_NAME}\n\n"
        "You already have an account\n\n"
        f"Someone just tried to sign up for {APP_NAME} with this email address, but an account "
        "already exists for it. No new account was created and nothing has changed.\n\n"
        "If that was you, sign in with your existing account instead.\n\n"
        "If it was not you, you can safely ignore this email.\n"
    )

    _send(
        to=to,
        subject=f"{APP_NAME}: account already exists",
        html_body=_layout(heading, body_html),
        text_body=text_body,
    )
