export type StrengthLevel = 'empty' | 'weak' | 'medium' | 'strong' | 'very-strong';

export type PasswordStrengthResult = {
  score: number;
  level: StrengthLevel;
  checks: {
    minLength: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
};

/** Max raw score from calculateStrength (length×2 + 4 variety). */
export const PASSWORD_STRENGTH_MAX_SCORE = 6;

export function calculateStrength(password: string): PasswordStrengthResult {
  const checks = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  if (!password) {
    return { score: 0, level: 'empty', checks };
  }

  let score = 0;
  if (password.length > 5) score += 1;
  if (password.length > 8) score += 1;
  if (checks.uppercase) score += 1;
  if (checks.lowercase) score += 1;
  if (checks.number) score += 1;
  if (checks.special) score += 1;

  let level: StrengthLevel = 'empty';
  if (score === 0) level = 'empty';
  else if (score <= 2) level = 'weak';
  else if (score <= 4) level = 'medium';
  else if (score <= 5) level = 'strong';
  else level = 'very-strong';

  return { score, level, checks };
}

export const strengthLabels: Record<StrengthLevel, string> = {
  empty: 'Empty',
  weak: 'Weak',
  medium: 'Medium',
  strong: 'Strong',
  'very-strong': 'Very Strong',
};

/** Bar / badge fill — Sentry semantic + brand accent for medium. */
export const strengthBarColors: Record<StrengthLevel, string> = {
  empty: '#E6E6E9',
  weak: '#FF002B',
  medium: '#F29964',
  strong: '#009800',
  'very-strong': '#008900',
};

export const strengthLabelColors: Record<StrengthLevel, string> = {
  empty: '#6A6772',
  weak: '#D50000',
  medium: '#A45200',
  strong: '#008900',
  'very-strong': '#008900',
};

export const PASSWORD_REQUIREMENTS: { key: keyof PasswordStrengthResult['checks']; label: string }[] = [
  { key: 'minLength', label: 'At least 8 characters' },
  { key: 'uppercase', label: 'At least one uppercase letter' },
  { key: 'lowercase', label: 'At least one lowercase letter' },
  { key: 'number', label: 'At least one number' },
  { key: 'special', label: 'At least one special character' },
];
