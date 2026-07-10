import { describe, expect, it } from 'vitest';
import { openDb, type DB } from '../db.js';
import { createContact } from '../repositories/contacts.js';
import { createReason } from '../repositories/reasons.js';
import { buildEmergencyView } from './emergency.js';
import { telHref } from './content.js';

function freshDb(): DB {
  return openDb();
}

describe('telHref', () => {
  it('strips formatting to a dialable tel: href', () => {
    expect(telHref('0800 111 0 111')).toBe('tel:08001110111');
    expect(telHref('112')).toBe('tel:112');
    expect(telHref('+49 30 123456')).toBe('tel:+4930123456');
  });
});

describe('buildEmergencyView', () => {
  it('lists contacts, reasons and hotlines with the emergency number first', () => {
    const db = freshDb();
    createContact(db, { name: 'Sam', phone: '0170 1', sortOrder: 1 });
    createContact(db, { name: 'Mama', phone: '0170 2', sortOrder: 0 });
    createReason(db, { text: 'Klarer Kopf', createdAt: '2026-01-01T00:00:00.000Z' });

    const view = buildEmergencyView(db);
    // contacts come back in display order (sort_order)
    expect(view.contacts.map((c) => c.name)).toEqual(['Mama', 'Sam']);
    expect(view.reasons).toHaveLength(1);
    expect(view.hotlines.length).toBeGreaterThan(0);
    // the acute-emergency number is surfaced first
    expect(view.hotlines[0]!.emergency).toBe(true);
    expect(view.hotlines[0]!.phone).toBe('112');
  });

  it('works with no personal data yet', () => {
    const db = freshDb();
    const view = buildEmergencyView(db);
    expect(view.contacts).toEqual([]);
    expect(view.reasons).toEqual([]);
    expect(view.hotlines.length).toBeGreaterThan(0);
  });
});
