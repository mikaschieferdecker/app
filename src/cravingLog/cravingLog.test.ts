import { describe, expect, it } from 'vitest';
import { openDb, type DB } from '../db.js';
import { MS_PER_DAY } from '../time.js';
import { createAddiction } from '../repositories/addictions.js';
import { quickLogCraving, buildCravingLogView } from './cravingLog.js';

const T0 = '2026-05-01T18:00:00.000Z';
const clock = () => T0;
const minus = (ms: number) => new Date(Date.parse(T0) - ms).toISOString();

function freshDb(): DB {
  return openDb();
}

describe('quickLogCraving', () => {
  it('logs outside the panic flow with sensible defaults', () => {
    const db = freshDb();
    const log = quickLogCraving(db, {}, clock);
    expect(log.came_from_panic).toBe(0);
    expect(log.survived).toBe(1); // logged-and-survived by default
    expect(log.occurred_at).toBe(T0);
    expect(log.addiction_id).toBeNull();
  });

  it('captures the quick details', () => {
    const db = freshDb();
    const a = createAddiction(db, { type: 'alcohol', createdAt: T0 });
    const log = quickLogCraving(
      db,
      { addictionId: a.id, location: 'Bar / Kneipe', emotion: 'Stress', intensity: 7, trigger: 'Kollegen' },
      clock,
    );
    expect(log.addiction_id).toBe(a.id);
    expect(log.location).toBe('Bar / Kneipe');
    expect(log.emotion).toBe('Stress');
    expect(log.intensity).toBe(7);
    expect(log.trigger).toBe('Kollegen');
  });

  it('records a lapse when survived is false', () => {
    const db = freshDb();
    const log = quickLogCraving(db, { survived: false }, clock);
    expect(log.survived).toBe(0);
    expect(log.came_from_panic).toBe(0);
  });

  it('rejects an out-of-range intensity', () => {
    const db = freshDb();
    expect(() => quickLogCraving(db, { intensity: 0 }, clock)).toThrow();
    expect(() => quickLogCraving(db, { intensity: 11 }, clock)).toThrow();
  });
});

describe('buildCravingLogView', () => {
  it('returns recent entries newest-first with weekly and all-time counts', () => {
    const db = freshDb();
    quickLogCraving(db, { occurredAt: minus(2 * MS_PER_DAY), survived: true, trigger: 'Abends' }, clock);
    quickLogCraving(db, { occurredAt: minus(1 * MS_PER_DAY), survived: false, trigger: 'Streit' }, clock);
    quickLogCraving(db, { occurredAt: minus(10 * MS_PER_DAY), survived: true, trigger: 'alt' }, clock); // outside the week

    const view = buildCravingLogView(db, T0);
    expect(view.recent.map((c) => c.trigger)).toEqual(['Streit', 'Abends', 'alt']); // newest first
    expect(view.totalAllTime).toBe(3);
    expect(view.survivedAllTime).toBe(2);
    expect(view.weekTotal).toBe(2);
    expect(view.weekWins).toBe(1);
  });

  it('honours the recent limit', () => {
    const db = freshDb();
    for (let i = 1; i <= 5; i++) {
      quickLogCraving(db, { occurredAt: minus(i * MS_PER_DAY) }, clock);
    }
    expect(buildCravingLogView(db, T0, 3).recent).toHaveLength(3);
  });
});
