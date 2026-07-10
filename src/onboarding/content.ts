// Screen copy and option metadata for the onboarding flow.
// Kept as data so any UI (FlutterFlow, React, CLI, …) renders the same source of
// truth. Text is deliberately calm and non-dramatic, per the app concept.

import type { AddictionType, BaselinePeriod, Goal } from '../types.js';

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const ADDICTION_OPTIONS: Option<AddictionType>[] = [
  { value: 'alcohol', label: 'Alkohol' },
  { value: 'drugs', label: 'Drogen' },
  { value: 'gambling', label: 'Glücksspiel' },
];

export const GOAL_OPTIONS: Option<Goal>[] = [
  { value: 'abstinence', label: 'Ganz aufhören' },
  { value: 'reduction', label: 'Reduzieren' },
];

export const BASELINE_PERIOD_OPTIONS: Option<BaselinePeriod>[] = [
  { value: 'day', label: 'pro Tag' },
  { value: 'week', label: 'pro Woche' },
  { value: 'month', label: 'pro Monat' },
];

export const ONBOARDING_CONTENT = {
  welcome: {
    title: 'Willkommen',
    body:
      'Diese App ist dein Selbsthilfe- und Tracking-Begleiter – kein Ersatz für ' +
      'professionelle Hilfe. Wir gehen das gemeinsam an, Schritt für Schritt und ' +
      'in deinem Tempo.',
    cta: 'Los geht’s',
  },
  addictions: {
    title: 'Worum geht es?',
    subtitle: 'Wähle aus, was auf dich zutrifft – mehreres ist möglich.',
  },
  safety: {
    title: 'Wichtiger Sicherheitshinweis',
    body:
      'Ein körperlicher Entzug von Alkohol oder Drogen kann lebensgefährlich sein – ' +
      'zum Beispiel durch Krampfanfälle oder ein Delir (Delirium tremens). Hör bitte ' +
      'nicht abrupt und allein auf. Lass dich ärztlich begleiten und such dir ' +
      'Unterstützung bei einer Suchtberatung.',
    // The user must actively confirm this before continuing.
    acknowledgeLabel: 'Ich habe den Hinweis gelesen und verstanden.',
    resources: [
      'Suchtberatungsstelle in deiner Nähe (ärztliche/therapeutische Begleitung)',
      'Telefonseelsorge: 0800 111 0 111 – kostenlos, rund um die Uhr',
      'Im Notfall: 112',
    ],
  },
  startDate: {
    title: 'Seit wann bist du clean bzw. abstinent?',
    subtitle:
      'Standard ist heute. Wähl ruhig ein Datum in der Vergangenheit, wenn du schon ' +
      'länger clean bist. Ein Datum in der Zukunft ist nicht möglich.',
  },
  goal: {
    title: 'Was ist dein Ziel?',
    subtitle: 'Du kannst das später jederzeit ändern.',
  },
  baseline: {
    title: 'Bisheriger Konsum (optional)',
    subtitle:
      'Daraus berechnen wir später deine Ersparnis. Du kannst diesen Schritt ' +
      'überspringen.',
    skipLabel: 'Überspringen',
  },
  contacts: {
    title: 'Notfallkontakte (optional)',
    subtitle:
      'Ein bis zwei Menschen, die du im akuten Moment schnell erreichen kannst. Sie ' +
      'tauchen später im Panik-Flow auf. Du kannst das überspringen.',
    skipLabel: 'Überspringen',
  },
} as const;

/** Placeholder for the Home screen we build next. */
export const HOME_PLACEHOLDER = {
  title: 'Home',
  body: 'Hier entsteht dein Dashboard. (Platzhalter)',
} as const;
