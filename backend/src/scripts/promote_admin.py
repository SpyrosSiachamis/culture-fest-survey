"""Promote an existing account to admin. The way the *first* admin comes into being.

    docker compose exec backend python -m src.scripts.promote_admin you@example.com

Deliberately not an HTTP endpoint. ``POST /admin/accounts`` needs an admin to already exist, so
something has to break the circle, and the safest thing to break it with is shell access to the
server: an attacker who can run this can already read the database and the signing key, so it grants
nothing they did not have. A bootstrap *route* — even one gated on a one-time token or on "no admins
exist yet" — would be a second path to privilege reachable from the internet, and this application
has exactly one authentication mechanism on purpose.

The account must already exist and be verified: sign up through the normal flow first, confirm the
emailed code, then run this. Email addresses are only stored as peppered hashes, so the address is
hashed here with the same function and matched against ``email_hash`` — nothing is ever written back
in plaintext.
"""

import argparse
import sys

from src.auth import hash_identifier
from src.database.models import Account
from src.database.session import SessionLocal
from src.enums import AccountType


def promote(email: str) -> int:
    session = SessionLocal()
    try:
        account = (
            session.query(Account).filter(Account.email_hash == hash_identifier(email)).first()
        )

        if account is None:
            print(f"No account found for {email}. Sign up first, then run this again.")
            return 1

        if account.email_verified_at is None:
            print(
                f"{email} has not verified its email address yet. "
                "An unverified admin cannot sign in, so verify it first."
            )
            return 1

        if account.role == AccountType.ADMIN:
            print(f"{email} is already an admin ({account.id.split('-')[0].upper()}).")
            return 0

        account.role = AccountType.ADMIN
        session.commit()
        print(f"{email} is now an admin (reference {account.id.split('-')[0].upper()}).")
        return 0
    finally:
        session.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("email", help="Email address of an existing, verified account.")
    return promote(parser.parse_args().email)


if __name__ == "__main__":
    sys.exit(main())
