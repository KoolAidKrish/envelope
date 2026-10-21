export type Theme = {
  id: string;
  name: string;
  mood: string;
  displayFont: string; // Google Fonts family spec
  swatches: [string, string, string]; // background, card, accent (for the admin picker)
};

export const THEMES: Theme[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    mood: 'Navy and brass. Evenings, dinners, anything with a dress code.',
    displayFont: 'Gloock',
    swatches: ['#141A33', '#F2F3F7', '#B8913A'],
  },
  {
    id: 'garden',
    name: 'Garden',
    mood: 'Sage and rose. Brunches, showers, afternoons outside.',
    displayFont: 'Cormorant:ital,wght@0,500;0,600;1,500',
    swatches: ['#DCE5D6', '#FBFCF8', '#B45D72'],
  },
  {
    id: 'confetti',
    name: 'Confetti',
    mood: 'Ultramarine and tangerine. Birthdays, game nights, loud fun.',
    displayFont: 'Bricolage+Grotesque:opsz,wght@12..96,500;12..96,800',
    swatches: ['#2D38D1', '#FFFFFF', '#FF6B35'],
  },
  {
    id: 'ember',
    name: 'Ember',
    mood: 'Oxblood and copper. Winter parties, toasts, late nights.',
    displayFont: 'Bodoni+Moda:ital,opsz,wght@0,6..96,500;1,6..96,500',
    swatches: ['#4A1820', '#F5F0ED', '#C2763A'],
  },
];

export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

const BODY_FONT = 'Hanken+Grotesk:wght@400;500;600;700';

export function fontsHref(theme: Theme): string {
  const display = theme.displayFont.replace(/ /g, '+');
  return `https://fonts.googleapis.com/css2?family=${display}&family=${BODY_FONT}&display=swap`;
}

export function adminFontsHref(): string {
  return `https://fonts.googleapis.com/css2?family=Gloock&family=${BODY_FONT}&display=swap`;
}
