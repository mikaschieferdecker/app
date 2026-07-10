// Labels and copy for the progress / statistics screen (⑥).

import type { AddictionType } from '../types.js';
import { ADDICTION_LABELS } from '../home/content.js';

export type TimeBucket = 'morning' | 'afternoon' | 'evening' | 'night';

/** Day-order for display. */
export const TIME_BUCKETS: readonly TimeBucket[] = ['morning', 'afternoon', 'evening', 'night'];

export const TIME_BUCKET_LABELS: Record<TimeBucket, string> = {
  morning: 'Morgens',
  afternoon: 'Nachmittags',
  evening: 'Abends',
  night: 'Nachts',
};

/** Lower-case fragments for the insight sentence. */
export const TIME_BUCKET_PHRASES: Record<TimeBucket, string> = {
  morning: 'morgens',
  afternoon: 'nachmittags',
  evening: 'abends',
  night: 'nachts',
};

/** Monday-first weekday labels. */
export const WEEKDAY_LABELS: readonly string[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export const STATS_CONTENT = {
  title: 'Dein Fortschritt',
  streaksTitle: 'Cleane Zeit',
  patternsTitle: 'Muster',
  weeklyTitle: 'Cravings pro Woche',
  relapsesTitle: 'Rückfälle',
  // A relapse is a data point, not a verdict.
  relapseFraming: 'Rückfälle sind Datenpunkte, kein Versagen – sie zeigen, wo du Unterstützung brauchst.',
  emptyPatterns: 'Noch zu wenig Daten für Muster. Halte Cravings fest, dann zeigt sich hier mehr.',
  survivalRate: (rate: number): string => `${Math.round(rate * 100)}% überstanden`,
} as const;

export function addictionLabel(type: AddictionType): string {
  return ADDICTION_LABELS[type];
}
