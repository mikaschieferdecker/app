import type { DB } from '../db.js';
import type { EmergencyContact } from '../types.js';

export interface CreateContactInput {
  name: string;
  phone?: string | null;
  relationship?: string | null;
  sortOrder?: number;
}

export function createContact(db: DB, input: CreateContactInput): EmergencyContact {
  const info = db
    .prepare(
      `INSERT INTO emergency_contacts (name, phone, relationship, sort_order)
       VALUES (?, ?, ?, ?)`,
    )
    .run(input.name, input.phone ?? null, input.relationship ?? null, input.sortOrder ?? 0);
  return db
    .prepare('SELECT * FROM emergency_contacts WHERE id = ?')
    .get(Number(info.lastInsertRowid)) as EmergencyContact;
}

/** Lists contacts in display order (sort_order, then name). */
export function listContacts(db: DB): EmergencyContact[] {
  return db
    .prepare('SELECT * FROM emergency_contacts ORDER BY sort_order ASC, name ASC')
    .all() as EmergencyContact[];
}

export interface UpdateContactInput {
  name?: string;
  phone?: string | null;
  relationship?: string | null;
  sortOrder?: number;
}

export function updateContact(
  db: DB,
  id: number,
  input: UpdateContactInput,
): EmergencyContact {
  const current = db
    .prepare('SELECT * FROM emergency_contacts WHERE id = ?')
    .get(id) as EmergencyContact | undefined;
  if (!current) throw new Error(`Contact ${id} not found`);
  db.prepare(
    `UPDATE emergency_contacts
        SET name = ?, phone = ?, relationship = ?, sort_order = ?
      WHERE id = ?`,
  ).run(
    input.name ?? current.name,
    input.phone === undefined ? current.phone : input.phone,
    input.relationship === undefined ? current.relationship : input.relationship,
    input.sortOrder === undefined ? current.sort_order : input.sortOrder,
    id,
  );
  return db
    .prepare('SELECT * FROM emergency_contacts WHERE id = ?')
    .get(id) as EmergencyContact;
}

export function deleteContact(db: DB, id: number): void {
  db.prepare('DELETE FROM emergency_contacts WHERE id = ?').run(id);
}
