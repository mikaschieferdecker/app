import type { DB } from '../db.js';
import type { Addiction, AddictionType, BaselinePeriod } from '../types.js';
import { nowIso } from '../time.js';

export interface CreateAddictionInput {
  type: AddictionType;
  baselineAmount?: number | null;
  baselinePeriod?: BaselinePeriod | null;
  costPerUnit?: number | null;
  createdAt?: string;
}

/**
 * Creates an addiction. Callers that want an immediately-running streak should
 * follow up with `startCleanPeriod` — creating an addiction does not, on its
 * own, open a clean period.
 */
export function createAddiction(db: DB, input: CreateAddictionInput): Addiction {
  const info = db
    .prepare(
      `INSERT INTO addictions (type, baseline_amount, baseline_period, cost_per_unit, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      input.type,
      input.baselineAmount ?? null,
      input.baselinePeriod ?? null,
      input.costPerUnit ?? null,
      input.createdAt ?? nowIso(),
    );
  return getAddiction(db, Number(info.lastInsertRowid))!;
}

export function getAddiction(db: DB, id: number): Addiction | null {
  const row = db
    .prepare('SELECT * FROM addictions WHERE id = ?')
    .get(id) as Addiction | undefined;
  return row ?? null;
}

export function listAddictions(db: DB): Addiction[] {
  return db
    .prepare('SELECT * FROM addictions ORDER BY created_at ASC, id ASC')
    .all() as Addiction[];
}

export interface UpdateAddictionInput {
  baselineAmount?: number | null;
  baselinePeriod?: BaselinePeriod | null;
  costPerUnit?: number | null;
}

/** Updates the baseline/cost fields used for savings. Only provided fields change. */
export function updateAddiction(
  db: DB,
  id: number,
  input: UpdateAddictionInput,
): Addiction {
  const current = getAddiction(db, id);
  if (!current) throw new Error(`Addiction ${id} not found`);
  db.prepare(
    `UPDATE addictions
        SET baseline_amount = ?, baseline_period = ?, cost_per_unit = ?
      WHERE id = ?`,
  ).run(
    input.baselineAmount === undefined ? current.baseline_amount : input.baselineAmount,
    input.baselinePeriod === undefined ? current.baseline_period : input.baselinePeriod,
    input.costPerUnit === undefined ? current.cost_per_unit : input.costPerUnit,
    id,
  );
  return getAddiction(db, id)!;
}

/** Deletes an addiction; ON DELETE CASCADE removes its clean periods and milestones. */
export function deleteAddiction(db: DB, id: number): void {
  db.prepare('DELETE FROM addictions WHERE id = ?').run(id);
}
