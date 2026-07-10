// Copy and options for the panic / craving flow. Data-only, so any UI renders
// the same source of truth. Tone stays calm and encouraging — never alarmist.

import type { CopingAction } from './types.js';

/** Breathing pacer (~60 s): a 4-7-8 cycle repeated a handful of times. */
export const BREATHING = {
  inhaleSec: 4,
  holdSec: 7,
  exhaleSec: 8,
  cycles: 3, // ≈ 57 s
  labels: { inhale: 'Einatmen', hold: 'Halten', exhale: 'Ausatmen' },
} as const;

/** Urge-surfing timer defaults. */
export const URGE_SURFING = {
  suggestedMinutes: 15,
  maxMinutes: 20,
} as const;

export interface CopingOption {
  value: CopingAction;
  label: string;
  hint: string;
  icon: string;
}

export const COPING_OPTIONS: CopingOption[] = [
  { value: 'distraction', label: 'Ablenkung', hint: 'Etwas tun, das deine Aufmerksamkeit bindet.', icon: '🎧' },
  { value: 'call_contact', label: 'Jemanden anrufen', hint: 'Einen Notfallkontakt erreichen.', icon: '📞' },
  { value: 'exercise', label: 'Übung', hint: 'Atem, HALT-Check oder Gedanken sortieren.', icon: '🧭' },
];

/** Common emotions behind a craving (free text is also allowed). */
export const EMOTION_OPTIONS: string[] = [
  'Stress',
  'Einsamkeit',
  'Langeweile',
  'Wut',
  'Angst',
  'Traurigkeit',
  'Feiern',
];

export const PANIC_CONTENT = {
  breathe: {
    title: 'Erstmal durchatmen',
    subtitle: 'Wir fangen ruhig an. Folge dem Kreis für ungefähr eine Minute.',
  },
  surf: {
    title: 'Reite die Welle',
    body:
      'Ein Craving ist wie eine Welle: Es steigt an, erreicht einen Höhepunkt und ebbt ' +
      'wieder ab – meist innerhalb von 15 bis 20 Minuten. Du musst nicht dagegen ' +
      'ankämpfen, nur oben bleiben, bis es vorbei ist.',
    startTimer: 'Timer starten',
  },
  choose: {
    title: 'Was hilft dir jetzt?',
    subtitle: 'Wähl eine Sache – oder geh einfach weiter.',
  },
  outcome: {
    title: 'Geschafft?',
    subtitle: 'Ehrlich ist okay. Beides bringt dich weiter.',
    survived: 'Ja, überstanden',
    gaveIn: 'Nein, gekippt',
  },
  details: {
    title: 'Kurz festhalten (optional)',
    subtitle: 'Über die Zeit werden Muster sichtbar. Dauert keine 20 Sekunden.',
    locationLabel: 'Wo warst du?',
    emotionLabel: 'Gefühl',
    intensityLabel: 'Wie stark? (1–10)',
    triggerLabel: 'Auslöser',
    skipLabel: 'Überspringen',
  },
  doneSurvived: {
    title: 'Das war stark.',
    body:
      'Du hast ein Craving überstanden, ohne zu konsumieren. Genau das baut ' +
      'Selbstvertrauen auf – und es wird mit jedem Mal leichter.',
  },
  doneGaveIn: {
    title: 'Danke, dass du ehrlich bist.',
    body:
      'Ein Rückschlag löscht deinen Fortschritt nicht aus. Du hast die App geöffnet, ' +
      'statt sie wegzulegen – das zählt. Weiter geht’s.',
  },
} as const;
