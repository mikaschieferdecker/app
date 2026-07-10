// Content for the exercise / tool library (⑤): breathing, the HALT check,
// thought reframing (CBT), and management of personal reasons.

export type ExerciseKind = 'breathing' | 'halt' | 'reframe' | 'grounding';

export interface Exercise {
  id: string;
  kind: ExerciseKind;
  title: string;
  summary: string;
  /** Rough duration hint for the UI. */
  minutes: number;
  icon: string;
  /** Ordered steps the UI walks through. */
  steps: string[];
}

export const EXERCISES: Exercise[] = [
  {
    id: 'breathing-478',
    kind: 'breathing',
    title: 'Atemübung (4-7-8)',
    summary: 'Beruhigt das Nervensystem in etwa einer Minute.',
    minutes: 1,
    icon: '🌬️',
    steps: [
      'Setz oder leg dich bequem hin.',
      'Atme 4 Sekunden ruhig durch die Nase ein.',
      'Halte den Atem 7 Sekunden.',
      'Atme 8 Sekunden langsam durch den Mund aus.',
      'Wiederhole das Ganze drei- bis viermal.',
    ],
  },
  {
    id: 'halt-check',
    kind: 'halt',
    title: 'HALT-Check',
    summary: 'Hungrig, wütend, einsam oder müde? Oft steckt hinter einem Craving ein anderes Bedürfnis.',
    minutes: 1,
    icon: '🧭',
    steps: [
      'Frag dich ehrlich: Bin ich gerade hungrig?',
      '… wütend oder gereizt?',
      '… einsam?',
      '… müde?',
      'Kümmere dich zuerst um das Bedürfnis dahinter – das Craving wird oft kleiner.',
    ],
  },
  {
    id: 'thought-reframe',
    kind: 'reframe',
    title: 'Gedanken umdrehen',
    summary: 'Einen automatischen Gedanken erkennen, prüfen und umformulieren (CBT).',
    minutes: 3,
    icon: '🔄',
    steps: [
      'Welcher Gedanke schiebt dich gerade Richtung Konsum?',
      'Ist er wirklich wahr – oder redet die Sucht?',
      'Was würdest du einem Freund in dieser Lage sagen?',
      'Formuliere den Gedanken fairer und realistischer.',
    ],
  },
  {
    id: 'grounding-54321',
    kind: 'grounding',
    title: '5-4-3-2-1 Erdung',
    summary: 'Holt dich mit den Sinnen zurück in den Moment.',
    minutes: 2,
    icon: '🌱',
    steps: [
      'Nenne 5 Dinge, die du siehst.',
      '4 Dinge, die du hörst.',
      '3 Dinge, die du fühlst.',
      '2 Dinge, die du riechst.',
      '1 Sache, die du schmeckst.',
    ],
  },
];

export interface HaltItem {
  key: 'hungry' | 'angry' | 'lonely' | 'tired';
  label: string;
  question: string;
  suggestion: string;
}

export const HALT_ITEMS: HaltItem[] = [
  {
    key: 'hungry',
    label: 'Hungrig',
    question: 'Bist du hungrig?',
    suggestion: 'Iss etwas Kleines – ein niedriger Blutzucker macht Cravings stärker.',
  },
  {
    key: 'angry',
    label: 'Wütend',
    question: 'Bist du wütend oder gereizt?',
    suggestion: 'Bewegung oder ein paar tiefe Atemzüge nehmen den Druck raus.',
  },
  {
    key: 'lonely',
    label: 'Einsam',
    question: 'Fühlst du dich einsam?',
    suggestion: 'Melde dich bei jemandem – ein kurzer Kontakt reicht oft schon.',
  },
  {
    key: 'tired',
    label: 'Müde',
    question: 'Bist du müde?',
    suggestion: 'Gönn dir Ruhe. Müdigkeit schwächt deine Widerstandskraft.',
  },
];

export const TOOLBOX_CONTENT = {
  title: 'Werkzeuge',
  subtitle: 'Kleine Übungen für schwere Momente – und deine persönlichen Gründe.',
  exercisesTitle: 'Übungen',
  reasonsTitle: 'Meine Gründe',
  reasonsHint: 'Warum du aufhörst – in Krisen abrufbar. Du kannst sie jederzeit ergänzen.',
  reasonsEmpty: 'Noch keine Gründe hinterlegt. Schreib auf, was dich trägt.',
  haltAllClear: 'Nichts davon trifft zu – gut. Vielleicht hilft dir eine kurze Atemübung.',
  haltHeading: 'Kümmere dich zuerst darum:',
} as const;
