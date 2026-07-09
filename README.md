# recovery-db

SQLite schema and a small typed data-access layer for a **single-user addiction
recovery app**, built on [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3).

The design follows two rules from the schema:

- **Streaks are never stored.** They are always derived from the `clean_periods`
  interval table, so the source of truth is a set of `(started_at, ended_at)`
  intervals — a relapse just sets `ended_at`.
- **Timestamps are ISO-8601 UTC strings** (e.g. `2026-07-09T12:00:00.000Z`),
  matching the `TEXT` columns.

## Layout

| Path | Purpose |
| --- | --- |
| `src/schema.sql` | The full schema (tables, CHECK constraints, indexes). |
| `src/db.ts` | `openDb()` — opens a connection, enables foreign keys, applies the schema. |
| `src/types.ts` | Domain types mirroring each table. |
| `src/time.ts` | Time helpers and milestone thresholds. |
| `src/repositories/` | One module per concern (profile, addictions, clean periods, cravings, contacts, reasons, savings, milestones). |

## Quick start

```ts
import {
  openDb,
  createProfile,
  createAddiction,
  startCleanPeriod,
  recordRelapse,
  streakStats,
  checkAndRecordMilestones,
  perDayCost,
  moneySavedForAddiction,
} from 'recovery-db';

const db = openDb({ filename: 'recovery.db' }); // ':memory:' by default

createProfile(db, { goal: 'abstinence', onboardingDone: true });

const alcohol = createAddiction(db, {
  type: 'alcohol',
  baselineAmount: 70, // spent per...
  baselinePeriod: 'week', // ...week → 10/day
});

startCleanPeriod(db, alcohol.id);

// ...later
const stats = streakStats(db, alcohol.id);
console.log(stats.currentDays, 'days clean, longest', stats.longestDays);

// milestones return only what was *newly* crossed, so the UI celebrates once
const { newlyReached } = checkAndRecordMilestones(db, alcohol.id);

console.log('saved so far:', moneySavedForAddiction(db, alcohol));

// a relapse ends the current period; startNew resets and keeps going
recordRelapse(db, alcohol.id, { startNew: true });
```

## Key behaviours

- **Streaks** — `streakStats()` returns `currentMs/currentDays`, `longestMs/longestDays`
  and `relapseCount`, all computed from `clean_periods`. Opening a second period
  while one is running is rejected; use `recordRelapse(..., { startNew: true })`.
- **Milestones** — scoped to a **clean period**, not the addiction as a whole.
  After a relapse a fresh period begins, so the same key (e.g. `24h`) can be
  reached and celebrated again — matching the recovery-friendly principle of
  rewarding the return after a setback. Within one period,
  `checkAndRecordMilestones()` is idempotent via
  `UNIQUE(clean_period_id, milestone_key)`, so the celebration never
  double-fires. Thresholds live in `MILESTONE_THRESHOLDS_MS` (months ≈ 30 days,
  a year ≈ 365 days).
- **Savings** — `perDayCost()` normalises `baseline_amount/baseline_period` to a
  daily rate; `moneySavedForAddiction()` multiplies it by total clean days.
  `evaluateSavingsGoals()` stamps `achieved_at` exactly once when a goal is met.
- **Cravings** — `logCraving()` / `cravingStats()` track intensity, triggers,
  survival rate and panic-flow origin.

## Scripts

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest (in-memory DB, deterministic clock)
npm run build       # emit dist/ (+ copies schema.sql alongside the JS)
```

## Notes

Foreign keys are enabled on every connection (SQLite defaults them off), so
`ON DELETE CASCADE` (clean periods, milestones) and `ON DELETE SET NULL`
(craving logs) behave as declared. Deleting an addiction removes its clean
periods and milestones and detaches its craving logs.
