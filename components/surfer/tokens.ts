// components/ui/tokens.ts
// Źródło prawdy: DESIGN.md. Nie wymyślaj nowych wartości — dodaj je najpierw do DESIGN.md.
export const color = {
  purple: '#F29964',
  purpleFocus: '#F5C4A0',
  darkBtn: '#2F2F34',
  cardBorder: '#F4F4F5',
  panelBorder: '#E4E4E7',
  inputBorder: '#D4D4D8',
  textHeading: '#09090B',
  textPrimary: '#18181B',
  textSecondary: '#3F3F47',
  textMuted: '#52525C',
  textFaint: '#9F9FA9',
  white: '#FFFFFF',
  surfaceSubtle: '#F8F8F9',
  surfaceLight: '#F4F4F5',
  success: '#1AB25E',
  error: '#FF6F77',
  scoreLow: '#d70028',
  scoreMid: '#efa00d',
  scoreHigh: '#1ab25e',
} as const;

export const radius = { xs: 4, sm: 6, md: 8, card: 12, lg: 16, pill: 9999 } as const;

export const shadow = {
  input: '0px 1px 2px 0px rgba(26,29,40,0.06)',
  card: '0px 1px 2px 0px #1A1D280F',
  dropdown: '0px 18px 40px rgba(17,24,39,0.14), 0px 8px 18px rgba(17,24,39,0.09), 0px 2px 6px rgba(17,24,39,0.06)',
} as const;

export const font = { family: 'var(--font-family-primary)' } as const;
