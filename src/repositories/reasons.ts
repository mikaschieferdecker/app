import type { DB } from '../db.js';
import type { Reason } from '../types.js';
import { nowIso } from '../time.js';

export interface CreateReasonInput {
  text: string;
  sortOrder?: number;
  createdAt?: string;
}

/** Adds a "why I quit" reason shown in the panic flow. */
export function createReason(db: DB, input: CreateReasonInput): Reason {
  const info = db
    .prepare(
      `INSERT INTO reasons (text, sort_order, created_at) VALUES (?, ?, ?)`,
    )
    .run(input.text, input.sortOrder ?? 0, input.createdAt ?? nowIso());
  return db
    .prepare('SELECT * FROM reasons WHERE id = ?')
    .get(Number(info.lastInsertRowid)) as Reason;
}

/** Lists reasons in display order (sort_order, then creation time). */
export function listReasons(db: DB): Reason[] {
  return db
    .prepare('SELECT * FROM reasons ORDER BY sort_order ASC, created_at ASC, id ASC')
    .all() as Reason[];
}

export interface UpdateReasonInput {
  text?: string;
  sortOrder?: number;
}

export function updateReason(db: DB, id: number, input: UpdateReasonInput): Reason {
  const current = db.prepare('SELECT * FROM reasons WHERE id = ?').get(id) as
    | Reason
    | undefined;
  if (!current) throw new Error(`Reason ${id} not found`);
  db.prepare('UPDATE reasons SET text = ?, sort_order = ? WHERE id = ?').run(
    input.text ?? current.text,
    input.sortOrder === undefined ? current.sort_order : input.sortOrder,
    id,
  );
  return db.prepare('SELECT * FROM reasons WHERE id = ?').get(id) as Reason;
}

export function deleteReason(db: DB, id: number): void {
  db.prepare('DELETE FROM reasons WHERE id = ?').run(id);
}
