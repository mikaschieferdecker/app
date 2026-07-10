// Content for the savings-goals screen — the concept's strongest reward lever.

export const SAVINGS_CONTENT = {
  title: 'Spar-Ziele',
  subtitle: 'Was du nicht ausgibst, wird zu etwas, das dir gehört.',
  savedLabel: 'Bisher gespart',
  perDayLabel: 'pro Tag',
  addTitle: 'Neues Ziel',
  titlePlaceholder: 'z. B. Wochenende weg',
  amountPlaceholder: 'Zielbetrag (€)',
  add: 'Ziel anlegen',
  empty: 'Noch kein Spar-Ziel. Leg dir eins an – ein echter Wunsch motiviert am meisten.',
  reachedBadge: 'Erreicht 🎉',
  achievedLine: 'Das hast DU dir durch dein Durchhalten ermöglicht.',
  daysToGo: (days: number): string =>
    days <= 0 ? 'geschafft' : days === 1 ? 'noch ~1 Tag' : `noch ~${days} Tage`,
  noRate: 'Hinterlege deinen bisherigen Konsum, um den Fortschritt zu berechnen.',
} as const;
