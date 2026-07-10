import { describe, expect, it } from 'vitest';
import { openDb, type DB } from '../db.js';
import { createAddiction } from '../repositories/addictions.js';
import { startCleanPeriod } from '../repositories/cleanPeriods.js';
import { createContact } from '../repositories/contacts.js';
import { createReason } from '../repositories/reasons.js';
import { cravingStats } from '../repositories/cravings.js';
import { buildHome } from '../home/home.js';
import { PanicController, commitPanicOutcome, getPanicResources } from './panic.js';
import { emptyPanicDraft } from './types.js';

const T0 = '2026-04-01T12:00:00.000Z';
const clock = () => T0;

function freshDb(): DB {
  return openDb();
}

describe('panic flow — navigation', () => {
  it('walks the steps and blocks the outcome step until answered', () => {
    const db = freshDb();
    const c = new PanicController(db, clock);
    expect(c.currentStep).toBe('breathe');
    c.next(); // surf
    c.next(); // choose
    c.setAction('distraction');
    c.next(); // outcome
    expect(c.currentStep).toBe('outcome');
    expect(() => c.next()).toThrow(/überstanden/);

    c.setSurvived(true);
    c.next(); // details
    expect(c.currentStep).toBe('details');
  });

  it('can go back through the flow', () => {
    const db = freshDb();
    const c = new PanicController(db, clock);
    c.next();
    c.next();
    expect(c.currentStep).toBe('choose');
    c.back();
    expect(c.currentStep).toBe('surf');
  });
});

describe('panic flow — outcome logging', () => {
  it('logs a survived craving from the panic flow with the session start time', () => {
    const db = freshDb();
    const a = createAddiction(db, { type: 'alcohol', createdAt: T0 });
    const c = new PanicController(db, clock, { addictionId: a.id });

    c.setSurvived(true);
    c.setDetails({ location: 'Zuhause', emotion: 'Stress', intensity: 8, trigger: 'Feierabend' });
    const log = c.complete();

    expect(log.came_from_panic).toBe(1);
    expect(log.survived).toBe(1);
    expect(log.addiction_id).toBe(a.id);
    expect(log.occurred_at).toBe(T0); // when the craving hit, not when logged
    expect(log.intensity).toBe(8);
    expect(log.emotion).toBe('Stress');
    expect(log.trigger).toBe('Feierabend');
    expect(c.currentStep).toBe('done');
  });

  it('records a relapse ("gave in") just as honestly', () => {
    const db = freshDb();
    const c = new PanicController(db, clock);
    c.setSurvived(false);
    const log = c.complete();
    expect(log.survived).toBe(0);
    expect(log.came_from_panic).toBe(1);
  });

  it('is idempotent: complete() does not double-log', () => {
    const db = freshDb();
    const c = new PanicController(db, clock);
    c.setSurvived(true);
    const first = c.complete();
    const second = c.complete();
    expect(second.id).toBe(first.id);
    expect(cravingStats(db).total).toBe(1);
  });

  it('rejects an out-of-range intensity', () => {
    const db = freshDb();
    const c = new PanicController(db, clock);
    expect(() => c.setDetails({ intensity: 11 })).toThrow();
  });

  it('throws if committed without an outcome', () => {
    const db = freshDb();
    expect(() => commitPanicOutcome(db, emptyPanicDraft(), T0)).toThrow(/überstanden/);
  });
});

describe('panic flow — resources & integration', () => {
  it('exposes contacts and reasons for the flow', () => {
    const db = freshDb();
    createContact(db, { name: 'Sam', phone: '0170 1' });
    createReason(db, { text: 'Für meine Tochter', createdAt: T0 });
    const res = getPanicResources(db);
    expect(res.contacts).toHaveLength(1);
    expect(res.reasons).toHaveLength(1);
  });

  it('feeds craving wins and panic counts back into the dashboard', () => {
    const db = freshDb();
    const a = createAddiction(db, { type: 'gambling', createdAt: T0 });
    startCleanPeriod(db, a.id, T0);

    const c = new PanicController(db, clock, { addictionId: a.id });
    c.setSurvived(true);
    c.complete();

    expect(buildHome(db, T0).cravingWinsThisWeek).toBe(1);
    expect(cravingStats(db).fromPanic).toBe(1);
  });
});
