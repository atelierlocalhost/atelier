-- Atelier SQLite schema (frozen contract; tell the team before editing)
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  category TEXT,
  tags TEXT,            -- comma-separated
  image_url TEXT,
  stripe_link TEXT
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY,
  name TEXT,
  email TEXT,
  city TEXT,
  signup_date TEXT      -- ISO date
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  product_id INTEGER REFERENCES products(id),
  amount REAL NOT NULL,
  created_at TEXT NOT NULL   -- ISO datetime
);

CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY,
  run_id TEXT,
  type TEXT,            -- coupon | bundle | winback_email | acquisition_post
  segment TEXT,
  payload_json TEXT,
  status TEXT DEFAULT 'proposed'   -- proposed | approved | applied
);

CREATE TABLE IF NOT EXISTS costs (
  id INTEGER PRIMARY KEY,
  run_id TEXT,
  provider TEXT,        -- tinfoil | darkbloom | sie
  model TEXT,
  tokens INTEGER,
  usd REAL
);
