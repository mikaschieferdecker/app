import { describe, expect, it } from 'vitest';
import { openDb, type DB } from '../db.js';
import { createReason } from '../repositories/reasons.js';
import { buildToolboxView, evaluateHalt } from './toolbox.js';

function freshDb(): DB {
  return openDb();
}

describe('evaluateHalt', () => {
  it('flags the needs behind a craving with concrete suggestions', () => {
    const result = evaluateHalt({ hungry: true, tired: true });
    expect(result.allClear).toBe(false);
    expect(result.flagged.map((f) => f.key)).toEqual(['hungry', 'tired']);
    expect(result.flagged[0]!.suggestion).toMatch(/Blutzucker/);
  });

  it('is all-clear when nothing applies', () => {
    const result = evaluateHalt({});
    expect(result.allClear).toBe(true);
    expect(result.flagged).toEqual([]);
  });

  it('preserves HALT order regardless of answer order', () => {
    const result = evaluateHalt({ tired: true, hungry: true, angry: true });
    expect(result.flagged.map((f) => f.key)).toEqual(['hungry', 'angry', 'tired']);
  });
});

describe('buildToolboxView', () => {
  it('returns the built-in exercises and personal reasons', () => {
    const db = freshDb();
    createReason(db, { text: 'Für meine Gesundheit', sortOrder: 1, createdAt: '2026-01-01T00:00:00.000Z' });
    createReason(db, { text: 'Klarer Kopf', sortOrder: 0, createdAt: '2026-01-01T00:00:00.000Z' });

    const view = buildToolboxView(db);
    expect(view.exercises.length).toBeGreaterThanOrEqual(4);
    expect(view.exercises.some((e) => e.kind === 'halt')).toBe(true);
    // reasons come back in display order (sort_order)
    expect(view.reasons.map((r) => r.text)).toEqual(['Klarer Kopf', 'Für meine Gesundheit']);
  });

  it('every exercise has steps', () => {
    const db = freshDb();
    for (const ex of buildToolboxView(db).exercises) {
      expect(ex.steps.length).toBeGreaterThan(0);
    }
  });
});
