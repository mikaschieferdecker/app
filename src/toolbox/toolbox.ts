import type { DB } from '../db.js';
import type { Reason } from '../types.js';
import { listReasons } from '../repositories/reasons.js';
import { EXERCISES, HALT_ITEMS, type Exercise, type HaltItem } from './content.js';

export interface ToolboxView {
  exercises: Exercise[];
  reasons: Reason[];
}

/** The tool library: the built-in exercises plus the user's personal reasons. */
export function buildToolboxView(db: DB): ToolboxView {
  return { exercises: EXERCISES, reasons: listReasons(db) };
}

export interface HaltAnswers {
  hungry?: boolean;
  angry?: boolean;
  lonely?: boolean;
  tired?: boolean;
}

export interface HaltFlag {
  key: HaltItem['key'];
  label: string;
  suggestion: string;
}

export interface HaltResult {
  /** Needs the user flagged, each with a concrete suggestion. */
  flagged: HaltFlag[];
  /** True when nothing was flagged. */
  allClear: boolean;
}

/**
 * Turns HALT answers (Hungry / Angry / Lonely / Tired) into concrete, gentle
 * suggestions for the needs behind a craving. Pure and side-effect free.
 */
export function evaluateHalt(answers: HaltAnswers): HaltResult {
  const flagged = HALT_ITEMS.filter((item) => answers[item.key]).map((item) => ({
    key: item.key,
    label: item.label,
    suggestion: item.suggestion,
  }));
  return { flagged, allClear: flagged.length === 0 };
}
