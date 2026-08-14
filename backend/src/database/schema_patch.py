"""Additive, idempotent schema patches applied at startup.

``Base.metadata.create_all()`` creates missing *tables* but never alters existing ones, so a column
added to a model that is already deployed would silently never appear in the database. This module
fills that gap for the columns this application cannot run without.

Everything here is strictly additive: it only ever adds a column that is missing. Nothing is
dropped, reset or rewritten, so it is safe to run against a database with real data in it.
"""

import logging

from sqlalchemy import Engine, text

logger = logging.getLogger(__name__)

# (table, column, DDL type) tuples that must exist. Adding to this list is the way to ship a new
# nullable column without a full migration tool.
_REQUIRED_COLUMNS: list[tuple[str, str, str]] = [
    ("accounts", "email_verified_at", "DATETIME NULL DEFAULT NULL"),
]


def ensure_columns(engine: Engine) -> None:
    """Add any missing column from ``_REQUIRED_COLUMNS`` to an existing MySQL schema."""
    # On SQLite (tests) create_all() already builds the tables from the current models, so there is
    # nothing to patch and information_schema does not exist.
    if engine.dialect.name != "mysql":
        return

    with engine.begin() as connection:
        for table, column, ddl_type in _REQUIRED_COLUMNS:
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
            logger.info("Added missing column %s.%s", table, column)
