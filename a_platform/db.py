"""SQLite helpers. Owned by Person A."""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path

SCHEMA = Path(__file__).resolve().parent.parent / "shared" / "schema.sql"
DB_PATH = os.getenv("ATELIER_DB_PATH", str(Path(__file__).resolve().parent.parent / "atelier.db"))


def connect(path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(path: str = DB_PATH) -> None:
    with connect(path) as conn:
        conn.executescript(SCHEMA.read_text())
