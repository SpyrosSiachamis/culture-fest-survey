"""Additive, idempotent schema patches applied at startup.

``Base.metadata.create_all()`` creates missing *tables* but never alters existing ones, so a column
added to a model that is already deployed would silently never appear in the database. This module
fills that gap for the columns this application cannot run without.

Everything here is strictly additive: it only ever adds a column or an index that is missing.
Nothing is dropped, reset or rewritten, so it is safe to run against a database with real data in
it. The one statement that touches existing rows is the optional per-column backfill, which runs
only in the same pass that created the column.
"""

import logging

from sqlalchemy import Engine, text

logger = logging.getLogger(__name__)

# (table, column, DDL type, backfill) tuples that must exist. Adding to this list is the way to
# ship a new column without a full migration tool. `backfill` is a statement run once, immediately
# after the column is created, to give pre-existing rows the right value; None means the DDL
# default is already correct for them.
_REQUIRED_COLUMNS: list[tuple[str, str, str, str | None]] = [
    ("accounts", "email_verified_at", "DATETIME NULL DEFAULT NULL", None),
    # Redemption state. Accounts that already submitted a survey earned their claim before these
    # columns existed, so the backfill grants it to them rather than silently dropping it.
    (
        "accounts",
        "allowed_to_redeem",
        "BOOLEAN NOT NULL DEFAULT 0",
        "UPDATE accounts SET allowed_to_redeem = 1 WHERE has_voted = 1",
    ),
    ("accounts", "has_redeemed", "BOOLEAN NOT NULL DEFAULT 0", None),
    ("accounts", "redeemed_at", "DATETIME NULL DEFAULT NULL", None),
]

# (table, index name, DDL) for indexes belonging to a column added above — ADD COLUMN cannot carry
# a constraint that create_all() would have written as a separate index. Empty for now.
_REQUIRED_INDEXES: list[tuple[str, str, str]] = []


def ensure_columns(engine: Engine) -> None:
    """Add any missing column or index from the lists above to an existing MySQL schema."""
    # On SQLite (tests) create_all() already builds the tables from the current models, so there is
    # nothing to patch and information_schema does not exist.
    if engine.dialect.name != "mysql":
        return

    with engine.begin() as connection:
        for table, column, ddl_type, backfill in _REQUIRED_COLUMNS:
            exists = connection.execute(
                text(
                    "SELECT COUNT(*) FROM information_schema.columns "
                    "WHERE table_schema = DATABASE() "
                    "AND table_name = :table AND column_name = :column"
                ),
                {"table": table, "column": column},
            ).scalar()

            if exists:
                continue

            # Table/column names come from the module-level constant above, never from user input.
            connection.execute(text(f"ALTER TABLE `{table}` ADD COLUMN `{column}` {ddl_type}"))
            if backfill is not None:
                connection.execute(text(backfill))
            logger.info("Added missing column %s.%s", table, column)

        for table, index_name, ddl in _REQUIRED_INDEXES:
            exists = connection.execute(
                text(
                    "SELECT COUNT(*) FROM information_schema.statistics "
                    "WHERE table_schema = DATABASE() "
                    "AND table_name = :table AND index_name = :index_name"
                ),
                {"table": table, "index_name": index_name},
            ).scalar()

            if exists:
                continue

            connection.execute(text(ddl))
            logger.info("Added missing index %s on %s", index_name, table)
