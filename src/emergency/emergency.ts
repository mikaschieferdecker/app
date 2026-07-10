import type { DB } from '../db.js';
import type { EmergencyContact, Reason } from '../types.js';
import { listContacts } from '../repositories/contacts.js';
import { listReasons } from '../repositories/reasons.js';
import { HOTLINES, type Hotline } from './content.js';

export interface EmergencyView {
  /** Personal contacts, in display order. */
  contacts: EmergencyContact[];
  /** Curated hotlines, emergency number(s) first. */
  hotlines: Hotline[];
  /** Personal "why I quit" reasons, shown for grounding. */
  reasons: Reason[];
}

/**
 * Assembles the always-reachable help tab: the user's own contacts, the curated
 * hotline list (acute-emergency numbers first), and their personal reasons.
 */
export function buildEmergencyView(db: DB): EmergencyView {
  const hotlines = [...HOTLINES].sort(
    (a, b) => Number(b.emergency ?? false) - Number(a.emergency ?? false),
  );
  return {
    contacts: listContacts(db),
    hotlines,
    reasons: listReasons(db),
  };
}
