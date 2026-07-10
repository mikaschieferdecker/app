// Content for the always-reachable emergency / help tab (⑦).
//
// NOTE: the hotline list below is for Germany and should be VERIFIED against the
// current official numbers before release — phone numbers and offerings change.
// Keeping it here as data makes that review (and localisation) a single edit.

export interface Hotline {
  name: string;
  phone: string;
  description: string;
  /** e.g. "kostenlos · rund um die Uhr". */
  availability: string;
  /** True for the acute-danger emergency number, surfaced most prominently. */
  emergency?: boolean;
}

export const HOTLINES: Hotline[] = [
  {
    name: 'Notruf',
    phone: '112',
    description: 'Bei akuter Gefahr für dich oder andere.',
    availability: 'rund um die Uhr',
    emergency: true,
  },
  {
    name: 'Telefonseelsorge',
    phone: '0800 111 0 111',
    description: 'Anonyme Gesprächshilfe in Krisen.',
    availability: 'kostenlos · rund um die Uhr',
  },
  {
    name: 'Telefonseelsorge (alternativ)',
    phone: '0800 111 0 222',
    description: 'Zweite kostenlose Leitung, falls die erste besetzt ist.',
    availability: 'kostenlos · rund um die Uhr',
  },
  {
    name: 'Sucht- & Drogen-Hotline',
    phone: '01805 31 30 31',
    description: 'Erste Anlaufstelle bei Suchtfragen und Weitervermittlung.',
    availability: '0,14 €/Min aus dem Festnetz',
  },
];

export const EMERGENCY_CONTENT = {
  title: 'Hilfe',
  intro: 'Du musst da nicht allein durch. Hier erreichst du schnell jemanden.',
  contactsTitle: 'Deine Notfallkontakte',
  contactsEmpty: 'Noch keine Kontakte hinterlegt. Du kannst sie in den Einstellungen ergänzen.',
  hotlinesTitle: 'Hotlines & Beratung',
  reasonsTitle: 'Warum du das machst',
  reasonsEmpty: 'Noch keine Gründe hinterlegt.',
  callLabel: 'Anrufen',
} as const;

/** Builds a `tel:` href from a display phone number. */
export function telHref(phone: string): string {
  const cleaned = phone.replace(/[^+\d]/g, '');
  return `tel:${cleaned}`;
}
