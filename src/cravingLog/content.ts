// Copy and options for the standalone craving / trigger quick log (screen ④).
// Data-only so any UI renders the same source of truth.

// Reuse the canonical emotion list from the panic flow to avoid drift.
export { EMOTION_OPTIONS } from '../panic/content.js';

/** Common places, offered as quick suggestions (free text is also allowed). */
export const LOCATION_SUGGESTIONS: string[] = [
  'Zuhause',
  'Arbeit',
  'Unterwegs',
  'Bar / Kneipe',
  'Bei Freunden',
  'Online',
];

export const CRAVING_LOG_CONTENT = {
  title: 'Craving festhalten',
  subtitle: 'Schnell erfasst – in unter 20 Sekunden. Über die Zeit werden Muster sichtbar.',
  intensityLabel: 'Wie stark? (1–10)',
  emotionLabel: 'Gefühl',
  locationLabel: 'Wo warst du?',
  triggerLabel: 'Auslöser',
  outcomeLabel: 'Und dann?',
  survived: 'Überstanden',
  gaveIn: 'Gekippt',
  save: 'Speichern',
  savedToast: 'Festgehalten. Gut, dass du hinschaust.',
  recentTitle: 'Zuletzt',
  weekSummary: (wins: number, total: number): string =>
    total === 0
      ? 'Noch keine Cravings diese Woche erfasst.'
      : `Diese Woche ${wins} von ${total} Cravings überstanden.`,
} as const;
