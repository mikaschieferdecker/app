import type { DB } from '../db.js';
import type { CravingLog, EmergencyContact, Reason } from '../types.js';
import { nowIso, type Clock } from '../time.js';
import { logCraving } from '../repositories/cravings.js';
import { listContacts } from '../repositories/contacts.js';
import { listReasons } from '../repositories/reasons.js';
import {
  emptyPanicDraft,
  PANIC_STEPS,
  type CopingAction,
  type PanicDraft,
  type PanicStepId,
} from './types.js';

export interface PanicResources {
  contacts: EmergencyContact[];
  reasons: Reason[];
}

/** Contacts and personal reasons shown during the flow (from the panic button). */
export function getPanicResources(db: DB): PanicResources {
  return { contacts: listContacts(db), reasons: listReasons(db) };
}

export interface PanicDetails {
  location?: string | null;
  emotion?: string | null;
  intensity?: number | null;
  trigger?: string | null;
}

/**
 * Persists the outcome of a panic session as a craving log with
 * came_from_panic = 1. `occurredAt` is the moment the craving hit (the session
 * start), not when the log is written. A relapse ("gave in") is recorded just
 * as honestly as a win.
 */
export function commitPanicOutcome(
  db: DB,
  draft: PanicDraft,
  occurredAt: string,
): CravingLog {
  if (draft.survived === null) {
    throw new Error('Bitte halte fest, ob du es überstanden hast.');
  }
  return logCraving(db, {
    addictionId: draft.addictionId,
    occurredAt,
    location: draft.location,
    emotion: draft.emotion,
    intensity: draft.intensity,
    trigger: draft.trigger,
    survived: draft.survived,
    cameFromPanic: true,
  });
}

/**
 * Drives the guided panic / craving flow: calm breathing, urge-surfing, a coping
 * choice, the honest "Geschafft?" check, and an optional quick trigger log. The
 * session's start time is captured from the injected clock and used as the
 * craving's occurred_at, so the log reflects when the craving actually hit.
 */
export class PanicController {
  readonly draft: PanicDraft;
  /** When the craving hit — used as the logged occurred_at. */
  readonly startedAt: string;
  private cursor: PanicStepId = 'breathe';
  private outcome: CravingLog | null = null;

  constructor(
    private readonly db: DB,
    clock: Clock = nowIso,
    options: { addictionId?: number | null } = {},
  ) {
    this.startedAt = clock();
    this.draft = emptyPanicDraft(options.addictionId ?? null);
  }

  get steps(): readonly PanicStepId[] {
    return PANIC_STEPS;
  }

  get currentStep(): PanicStepId {
    return this.cursor;
  }

  get isFirstStep(): boolean {
    return this.cursor === PANIC_STEPS[0];
  }

  get isLastStep(): boolean {
    return this.cursor === PANIC_STEPS[PANIC_STEPS.length - 1];
  }

  /** The committed craving log, once complete() has run. */
  get result(): CravingLog | null {
    return this.outcome;
  }

  setAction(action: CopingAction | null): void {
    this.draft.action = action;
  }

  setSurvived(survived: boolean): void {
    this.draft.survived = survived;
  }

  setDetails(details: PanicDetails): void {
    if (details.intensity != null && (details.intensity < 1 || details.intensity > 10)) {
      throw new Error('Intensität muss zwischen 1 und 10 liegen.');
    }
    if (details.location !== undefined) this.draft.location = details.location;
    if (details.emotion !== undefined) this.draft.emotion = details.emotion;
    if (details.intensity !== undefined) this.draft.intensity = details.intensity;
    if (details.trigger !== undefined) this.draft.trigger = details.trigger;
  }

  validateStep(step: PanicStepId = this.cursor): string | null {
    if (step === 'outcome' && this.draft.survived === null) {
      return 'Bitte halte fest, ob du es überstanden hast.';
    }
    return null;
  }

  next(): void {
    const error = this.validateStep();
    if (error) throw new Error(error);
    const i = PANIC_STEPS.indexOf(this.cursor);
    const nextStep = PANIC_STEPS[i + 1];
    if (nextStep) this.cursor = nextStep;
  }

  back(): void {
    const i = PANIC_STEPS.indexOf(this.cursor);
    const prevStep = i > 0 ? PANIC_STEPS[i - 1] : undefined;
    if (prevStep) this.cursor = prevStep;
  }

  /**
   * Logs the craving (idempotent within a session) and advances to the closing
   * screen. Returns the created log.
   */
  complete(): CravingLog {
    if (!this.outcome) {
      this.outcome = commitPanicOutcome(this.db, this.draft, this.startedAt);
    }
    this.cursor = 'done';
    return this.outcome;
  }
}
