// Labels and copy for the home dashboard. Kept as data so any UI renders the
// same source of truth.

import type { AddictionType, Goal, MilestoneKey } from '../types.js';

export const ADDICTION_LABELS: Record<AddictionType, string> = {
  alcohol: 'Alkohol',
  drugs: 'Drogen',
  gambling: 'Glücksspiel',
};

export const GOAL_LABELS: Record<Goal, string> = {
  abstinence: 'Ganz aufhören',
  reduction: 'Reduzieren',
};

export const MILESTONE_LABELS: Record<MilestoneKey, string> = {
  '24h': '24 Stunden',
  '3d': '3 Tage',
  '1w': '1 Woche',
  '2w': '2 Wochen',
  '1m': '1 Monat',
  '3m': '3 Monate',
  '6m': '6 Monate',
  '1y': '1 Jahr',
};

/** Mood scale for the daily check-in (1..5). */
export const MOOD_LABELS: Record<number, string> = {
  1: 'Sehr schwer',
  2: 'Schwer',
  3: 'Okay',
  4: 'Gut',
  5: 'Stark',
};

export const HOME_CONTENT = {
  cleanCounterUnit: { one: 'Tag frei', other: 'Tage frei' },
  notCleanLabel: 'Neustart – Tag 1 beginnt, sobald du startest',
  savingsLabel: 'Bisher gespart',
  nextMilestoneLabel: 'Nächster Meilenstein',
  cravingWinsLabel: 'Überstandene Cravings diese Woche',
  checkin: {
    prompt: 'Wie geht’s dir heute?',
    doneToday: 'Danke – für heute erledigt.',
  },
  panic: {
    button: 'Ich brauche jetzt Hilfe',
    hint: 'Atmen, durchhalten, jemanden erreichen.',
  },
} as const;
