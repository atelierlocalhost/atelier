"""Deterministic dev fixture DB (used when a_platform/seed.py isn't ready).

~80 customers, ~200 orders over 6 months, with a clear At risk group:
customers who ordered 3-4 times at a good basket size, then went quiet 3-5 months ago.
"""
from __future__ import annotations

import random
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

SCHEMA = Path(__file__).resolve().parent.parent / "shared" / "schema.sql"
AS_OF = datetime(2026, 11, 1)

PRODUCTS = [
    ("Washed linen shirt", 89.0, "tops"), ("Linen wide-leg trouser", 119.0, "bottoms"),
    ("Silk slip skirt", 98.0, "bottoms"), ("Merino crew knit", 135.0, "knitwear"),
    ("Organic cotton tee", 39.0, "tops"), ("Barrel-leg denim", 128.0, "bottoms"),
    ("Butter yellow cardigan", 112.0, "knitwear"), ("Leather tote", 165.0, "accessories"),
    ("Gold hoop earrings", 48.0, "accessories"), ("Linen midi dress", 148.0, "dresses"),
]
CITIES = ["Oakland", "Berkeley", "San Francisco", "Alameda", "Emeryville"]

# (label, count, orders range, days since last order, basket multiplier);
# earlier orders fall between the last order and 180 days ago.
GROUPS = [
    ("Champions", 8, (6, 8), (1, 14), 1.4),
    ("Loyal", 16, (3, 4), (10, 45), 0.9),
    ("New", 14, (1, 1), (1, 30), 0.8),
    ("At risk", 16, (3, 4), (90, 120), 1.1),
    ("Hibernating", 26, (1, 2), (140, 180), 0.6),
]


def make_fixture(path: str | Path) -> dict[int, str]:
    """Create a fresh fixture DB at `path`. Returns {customer_id: intended group}."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.unlink(missing_ok=True)
    rnd = random.Random(42)
    conn = sqlite3.connect(path)
    conn.executescript(SCHEMA.read_text())
    conn.executemany(
        "INSERT INTO products (id, name, price, category, tags) VALUES (?, ?, ?, ?, ?)",
        [(i + 1, n, p, c, c) for i, (n, p, c) in enumerate(PRODUCTS)],
    )
    labels: dict[int, str] = {}
    cid = oid = 0
    for label, count, (lo, hi), (d_lo, d_hi), mult in GROUPS:
        for _ in range(count):
            cid += 1
            labels[cid] = label
            n_orders = rnd.randint(lo, hi)
            last = rnd.randint(d_lo, d_hi)
            days = sorted([last] + [rnd.randint(last, 180) for _ in range(n_orders - 1)], reverse=True)
            signup = AS_OF - timedelta(days=days[0] + rnd.randint(0, 10))
            conn.execute(
                "INSERT INTO customers (id, name, email, city, signup_date) VALUES (?, ?, ?, ?, ?)",
                (cid, f"Customer {cid}", f"c{cid}@example.com", rnd.choice(CITIES), signup.date().isoformat()),
            )
            for d in days:
                oid += 1
                pid = rnd.randint(1, len(PRODUCTS))
                amount = round(PRODUCTS[pid - 1][1] * mult * rnd.uniform(0.8, 1.2), 2)
                created = AS_OF - timedelta(days=d, hours=rnd.randint(0, 12))
                conn.execute(
                    "INSERT INTO orders (id, customer_id, product_id, amount, created_at) VALUES (?, ?, ?, ?, ?)",
                    (oid, cid, pid, amount, created.isoformat(timespec="seconds")),
                )
    conn.commit()
    conn.close()
    return labels
