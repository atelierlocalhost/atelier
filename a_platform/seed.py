"""Seed the demo boutique (products, customers, orders). Owned by Person A.

TODO(A): generate realistic products/customers/orders with a clear At risk segment.
"""
from a_platform.db import DB_PATH, init_db


def seed(path: str = DB_PATH) -> None:
    init_db(path)


if __name__ == "__main__":
    seed()
