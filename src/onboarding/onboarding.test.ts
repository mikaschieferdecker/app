import { describe, expect, it } from 'vitest';
import { openDb, type DB } from '../db.js';
import { MS_PER_DAY } from '../time.js';
import { listAddictions } from '../repositories/addictions.js';
import { getProfile } from '../repositories/profile.js';
import { listContacts } from '../repositories/contacts.js';
import { getCurrentPeriod, streakStats } from '../repositories/cleanPeriods.js';
import { OnboardingController, resolveInitialRoute } from './controller.js';
import { commitOnboarding, isOnboardingComplete } from './commit.js';
import { emptyDraft } from './types.js';

const T0 = '2026-01-01T00:00:00.000Z';
const fixedClock = () => T0;
const minus = (ms: number) => new Date(Date.parse(T0) - ms).toISOString();
const plus = (ms: number) => new Date(Date.parse(T0) + ms).toISOString();

function freshDb(): DB {
  return openDb();
}

describe('onboarding — routing & skip', () => {
  it('routes to onboarding until complete, then home, and never re-runs', () => {
    const db = freshDb();
    expect(isOnboardingComplete(db)).toBe(false);
    expect(resolveInitialRoute(db)).toBe('onboarding');

    const c = new OnboardingController(db, fixedClock);
    c.setAddictions(['gambling']);
    c.useToday();
    c.setGoal('abstinence');
    c.complete();

    expect(isOnboardingComplete(db)).toBe(true);
    expect(resolveInitialRoute(db)).toBe('home');
  });
});

describe('onboarding — single addiction, no safety step', () => {
  it('creates one addiction + clean period and stores the goal', () => {
    const db = freshDb();
    const c = new OnboardingController(db, fixedClock);

    // gambling is not safety-critical → no safety step in the flow
    c.setAddictions(['gambling']);
    expect(c.steps).not.toContain('safety');

    c.useToday();
    c.setGoal('reduction');
    const result = c.complete();

    const addictions = listAddictions(db);
    expect(addictions).toHaveLength(1);
    expect(addictions[0]!.type).toBe('gambling');
    expect(result.addictionIds.gambling).toBe(addictions[0]!.id);

    const period = getCurrentPeriod(db, addictions[0]!.id);
    expect(period?.started_at).toBe(T0);
    expect(period?.ended_at).toBeNull();

    expect(getProfile(db)?.goal).toBe('reduction');
    expect(getProfile(db)?.onboarding_done).toBe(1);
  });

  it('accepts a past start date and reflects it in the streak, but rejects the future', () => {
    const db = freshDb();
    const c = new OnboardingController(db, fixedClock);
    c.setAddictions(['gambling']);
    c.next(); // welcome -> addictions
    c.next(); // addictions -> startDate
    expect(c.currentStep).toBe('startDate');

    // future is rejected at the step
    c.setStartDate(plus(MS_PER_DAY));
    expect(c.validateStep('startDate')).toMatch(/Zukunft/);
    expect(() => c.next()).toThrow(/Zukunft/);

    // 10 days in the past is fine
    c.setStartDate(minus(10 * MS_PER_DAY));
    c.setGoal('abstinence');
    const { addictionIds } = c.complete();
    const stats = streakStats(db, addictionIds.gambling!, T0);
    expect(stats.currentDays).toBe(10);
  });
});

describe('onboarding — multiple addictions with safety step', () => {
  it('requires the safety step and blocks advancing without acknowledgement', () => {
    const db = freshDb();
    const c = new OnboardingController(db, fixedClock);
    c.setAddictions(['alcohol', 'drugs']);
    expect(c.steps).toContain('safety');

    // walk to the safety step
    expect(c.currentStep).toBe('welcome');
    c.next(); // -> addictions
    c.next(); // -> safety
    expect(c.currentStep).toBe('safety');
    expect(c.canAdvance()).toBe(false);
    expect(() => c.next()).toThrow(/Sicherheitshinweis/);

    c.acknowledgeSafety();
    expect(c.canAdvance()).toBe(true);
    c.next(); // -> startDate
    expect(c.currentStep).toBe('startDate');
  });

  it('creates one addiction and one clean period per selection', () => {
    const db = freshDb();
    const c = new OnboardingController(db, fixedClock);
    c.setAddictions(['drugs', 'alcohol']); // note: reverse of canonical order
    c.acknowledgeSafety();
    c.useToday();
    c.setGoal('abstinence');
    const { addictionIds } = c.complete();

    const addictions = listAddictions(db);
    expect(addictions.map((a) => a.type).sort()).toEqual(['alcohol', 'drugs']);
    for (const a of addictions) {
      expect(getCurrentPeriod(db, a.id)?.started_at).toBe(T0);
    }
    expect(Object.keys(addictionIds).sort()).toEqual(['alcohol', 'drugs']);
  });
});

describe('onboarding — optional steps', () => {
  it('works with baseline and contacts skipped', () => {
    const db = freshDb();
    const c = new OnboardingController(db, fixedClock);
    c.setAddictions(['gambling']);
    c.useToday();
    c.setGoal('abstinence');
    // no baseline, no contacts
    c.complete();

    const a = listAddictions(db)[0]!;
    expect(a.baseline_amount).toBeNull();
    expect(a.baseline_period).toBeNull();
    expect(listContacts(db)).toHaveLength(0);
  });

  it('stores baseline and contacts when provided', () => {
    const db = freshDb();
    const c = new OnboardingController(db, fixedClock);
    c.setAddictions(['alcohol']);
    c.acknowledgeSafety();
    c.useToday();
    c.setGoal('reduction');
    c.setBaseline('alcohol', 70, 'week');
    c.setContacts([
      { name: 'Sam', phone: '0170 1234567', relationship: 'Freund' },
      { name: 'Dr. Klein', phone: '030 987654' },
    ]);
    c.complete();

    const a = listAddictions(db)[0]!;
    expect(a.baseline_amount).toBe(70);
    expect(a.baseline_period).toBe('week');

    const contacts = listContacts(db);
    expect(contacts.map((x) => x.name)).toEqual(['Sam', 'Dr. Klein']);
    expect(contacts[0]!.sort_order).toBe(0);
    expect(contacts[1]!.sort_order).toBe(1);
  });
});

describe('onboarding — atomicity & completion flag', () => {
  it('does not set onboarding_done until complete() is called', () => {
    const db = freshDb();
    const c = new OnboardingController(db, fixedClock);
    c.setAddictions(['gambling']);
    c.useToday();
    c.setGoal('abstinence');

    // mid-flow: nothing written yet
    expect(getProfile(db)).toBeNull();
    expect(isOnboardingComplete(db)).toBe(false);

    c.complete();
    expect(getProfile(db)?.onboarding_done).toBe(1);
  });

  it('rolls back every write if a later statement fails (no half data)', () => {
    const db = freshDb();
    // Pre-existing profile makes createProfile inside the transaction fail
    // (single-row constraint) *after* addictions/contacts were written.
    db.prepare(
      "INSERT INTO user_profile (id, goal, created_at, onboarding_done) VALUES (1, 'abstinence', ?, 0)",
    ).run(T0);

    const draft = emptyDraft();
    draft.addictions = ['alcohol'];
    draft.safetyAcknowledged = true;
    draft.startDate = T0;
    draft.goal = 'reduction';
    draft.contacts = [{ name: 'Sam' }];

    expect(() => commitOnboarding(db, draft, fixedClock)).toThrow();

    // The transaction rolled back: no addictions, no contacts, flag untouched.
    expect(listAddictions(db)).toHaveLength(0);
    expect(listContacts(db)).toHaveLength(0);
    expect(getProfile(db)?.onboarding_done).toBe(0);
  });

  it('rejects an empty selection', () => {
    const db = freshDb();
    const c = new OnboardingController(db, fixedClock);
    c.useToday();
    c.setGoal('abstinence');
    expect(() => c.complete()).toThrow(/mindestens eine Sucht/);
    expect(getProfile(db)).toBeNull();
  });
});

describe('onboarding — back navigation', () => {
  it('moves back through steps and drops the safety step when deselected', () => {
    const db = freshDb();
    const c = new OnboardingController(db, fixedClock);
    c.setAddictions(['alcohol']);
    c.next(); // addictions
    c.next(); // safety
    c.back(); // addictions
    expect(c.currentStep).toBe('addictions');

    // deselect alcohol → safety step disappears from the order
    c.setAddictions(['gambling']);
    expect(c.steps).not.toContain('safety');
    c.next(); // startDate (skips safety)
    expect(c.currentStep).toBe('startDate');
  });
});
