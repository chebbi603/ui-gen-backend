export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const TYPOGRAPHY = {
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 14, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '400' },
} as const;

export const ELEVATION = { none: 0, low: 2, medium: 4, high: 8 } as const;

export const COLORS = {
  light: {
    primary: '#6750A4',
    surface: '#FFFFFF',
    background: '#F7F7F9',
    onPrimary: '#FFFFFF',
    onSurface: '#1A1B1E',
    onBackground: '#1A1B1E',
  },
  dark: {
    primary: '#D0BCFF',
    surface: '#1E1E1E',
    background: '#121212',
    onPrimary: '#1A1B1E',
    onSurface: '#E6E6E6',
    onBackground: '#E6E6E6',
  },
} as const;

export const CARD_DEFAULTS = {
  borderRadius: 12,
  padding: SPACING.md,
  elevation: ELEVATION.low,
} as const;

export const LIST_ITEM_HEIGHT = 56;

export const GRID_COLUMNS = { mobile: 1, tablet: 2 } as const;

export type ThemeMode = keyof typeof COLORS;

export function resolveThemeToken(token: string, mode: ThemeMode = 'light'): string | null {
  const key = token.replace(/^\$\{theme\./, '').replace(/\}$/, '');
  const theme = COLORS[mode] as Record<string, string>;
  return theme[key] ?? null;
}