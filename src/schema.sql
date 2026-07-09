-- Schema for a single-user addiction recovery app.
--
-- Design principles:
--   * Streaks are NEVER stored as a counter. They are always derived from
--     `clean_periods` so that the source of truth is a set of intervals.
--   * All timestamps are stored as ISO-8601 TEXT (UTC), e.g. 2026-07-09T12:00:00.000Z.
--   * Foreign keys must be enforced at connection time: PRAGMA foreign_keys = ON;

PRAGMA foreign_keys = ON;

-- Exactly one profile (single-user app).
CREATE TABLE IF NOT EXISTS user_profile (
  id                INTEGER PRIMARY KEY CHECK (id = 1), -- enforces a single row
  goal              TEXT NOT NULL CHECK (goal IN ('abstinence', 'reduction')),
  created_at        TEXT NOT NULL,
  onboarding_done   INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_done IN (0, 1))
);

-- Multiple addictions per person are possible.
CREATE TABLE IF NOT EXISTS addictions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  type              TEXT NOT NULL CHECK (type IN ('drugs', 'gambling', 'alcohol')),
  -- for the savings calculation:
  baseline_amount   REAL,                   -- e.g. cost per day/week/month
  baseline_period   TEXT CHECK (baseline_period IN ('day', 'week', 'month')),
  cost_per_unit     REAL,                   -- optional, depends on the addiction
  created_at        TEXT NOT NULL
);

-- The core: clean periods. NEVER store a streak counter,
-- always compute it from this table.
CREATE TABLE IF NOT EXISTS clean_periods (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  addiction_id      INTEGER NOT NULL REFERENCES addictions(id) ON DELETE CASCADE,
  started_at        TEXT NOT NULL,
  ended_at          TEXT,                   -- NULL = ongoing period (a relapse sets ended_at)
  end_reason        TEXT CHECK (end_reason IN ('relapse') OR end_reason IS NULL),
  created_at        TEXT NOT NULL
);

-- Craving / trigger log.
CREATE TABLE IF NOT EXISTS craving_logs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  addiction_id      INTEGER REFERENCES addictions(id) ON DELETE SET NULL,
  occurred_at       TEXT NOT NULL,
  location          TEXT,                   -- free text or categorized
  emotion           TEXT,
  intensity         INTEGER CHECK (intensity BETWEEN 1 AND 10),
  trigger           TEXT,
  survived          INTEGER NOT NULL DEFAULT 1 CHECK (survived IN (0, 1)), -- 1 = resisted, 0 = led to use
  came_from_panic   INTEGER NOT NULL DEFAULT 0 CHECK (came_from_panic IN (0, 1)), -- did the log come from the panic flow?
  created_at        TEXT NOT NULL
);

-- Emergency contacts.
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL,
  phone             TEXT,
  relationship      TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0
);

-- Personal "why I quit" reasons (available in the panic flow).
CREATE TABLE IF NOT EXISTS reasons (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  text              TEXT NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL
);

-- Savings goals.
CREATE TABLE IF NOT EXISTS savings_goals (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  title             TEXT NOT NULL,          -- "Weekend away"
  target_amount     REAL NOT NULL,          -- 300.00
  achieved_at       TEXT,                   -- NULL until achieved
  created_at        TEXT NOT NULL
);

-- Reached milestones (so the celebration animation doesn't trigger twice).
CREATE TABLE IF NOT EXISTS milestones_reached (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  addiction_id      INTEGER REFERENCES addictions(id) ON DELETE CASCADE,
  milestone_key     TEXT NOT NULL,          -- '24h','3d','1w','2w','1m','3m','6m','1y'
  reached_at        TEXT NOT NULL,
  UNIQUE(addiction_id, milestone_key)
);

-- Recommended indexes.
CREATE INDEX IF NOT EXISTS idx_clean_addiction ON clean_periods(addiction_id, started_at);
CREATE INDEX IF NOT EXISTS idx_craving_time    ON craving_logs(occurred_at);
