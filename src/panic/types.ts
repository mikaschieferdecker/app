/** Steps of the guided panic / craving flow. */
export type PanicStepId = 'breathe' | 'surf' | 'choose' | 'outcome' | 'details' | 'done';

export const PANIC_STEPS: readonly PanicStepId[] = [
  'breathe',
  'surf',
  'choose',
  'outcome',
  'details',
  'done',
];

/** Coping choice offered after the calming steps. */
export type CopingAction = 'distraction' | 'call_contact' | 'exercise';

/** Working state of one panic session. */
export interface PanicDraft {
  /** Which addiction this craving belongs to (optional). */
  addictionId: number | null;
  /** Chosen coping action (optional). */
  action: CopingAction | null;
  /** Did the user get through it without using? Set at the "Geschafft?" step. */
  survived: boolean | null;
  // Optional quick trigger details (screen ④), captured within the flow.
  location: string | null;
  emotion: string | null;
  intensity: number | null; // 1..10
  trigger: string | null;
}

export function emptyPanicDraft(addictionId: number | null = null): PanicDraft {
  return {
    addictionId,
    action: null,
    survived: null,
    location: null,
    emotion: null,
    intensity: null,
    trigger: null,
  };
}
