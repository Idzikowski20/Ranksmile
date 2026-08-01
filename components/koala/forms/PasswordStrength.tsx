import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../tokens/semantic';
import { typeface, textScale } from '../tokens/typography';
import { spacing } from '../tokens/spacing';
import { Icon } from '../icons/Icon';

export type PasswordRules = {
  minLength: boolean;
  special: boolean;
  number: boolean;
};

/** Shared password rules from Koala Account / Password (Figma `7906:208746`). */
export function evaluatePasswordRules(password: string): PasswordRules {
  return {
    minLength: password.length >= 8,
    special: /[^A-Za-z0-9]/.test(password),
    number: /\d/.test(password),
  };
}

export function passwordRulesPassed(rules: PasswordRules): number {
  return Number(rules.minLength) + Number(rules.special) + Number(rules.number);
}

export function passwordRulesComplete(rules: PasswordRules): boolean {
  return rules.minLength && rules.special && rules.number;
}

const RULES: Array<{ key: keyof PasswordRules; label: string }> = [
  { key: 'minLength', label: 'At least 8 characters' },
  { key: 'special', label: 'At least 1 special character' },
  { key: 'number', label: 'At least 1 number' },
];

const Root = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  width: 100%;
  font-family: ${typeface.body};
`;

const Track = styled.div`
  height: 6px;
  width: 100%;
  border-radius: 9999px;
  background: var(--koala-bg-tertiary, ${semantic.background.tertiary});
  overflow: hidden;
`;

const Fill = styled.div<{ $ratio: number; $tone: 'empty' | 'danger' | 'success' }>`
  height: 100%;
  width: ${(p) => `${Math.max(0, Math.min(1, p.$ratio)) * 100}%`};
  border-radius: 16px;
  background: ${(p) => {
    if (p.$tone === 'success') return semantic.status.success;
    if (p.$tone === 'danger') return semantic.status.danger;
    return 'transparent';
  }};
  transition: width 160ms ease, background 160ms ease;
`;

const Intro = styled.p`
  margin: 0;
  font-size: ${textScale.xs.fontSize};
  line-height: ${textScale.xs.lineHeight};
  letter-spacing: ${textScale.xs.letterSpacing};
  color: ${semantic.text.secondary};
`;

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Item = styled.li`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: ${textScale.xs.fontSize};
  line-height: ${textScale.xs.lineHeight};
  letter-spacing: ${textScale.xs.letterSpacing};
  color: ${semantic.text.secondary};
`;

export type PasswordStrengthProps = {
  value: string;
  className?: string;
};

export function PasswordStrength({ value, className }: PasswordStrengthProps) {
  // Hide until the user starts typing — empty fields must not reserve rule-list space.
  if (!value) return null;

  const rules = evaluatePasswordRules(value);
  const passed = passwordRulesPassed(rules);
  const ratio = passed / RULES.length;
  const tone = passed === 0 ? 'empty' : passwordRulesComplete(rules) ? 'success' : 'danger';

  return (
    <Root className={className} aria-live="polite">
      <Track aria-hidden="true">
        <Fill $ratio={ratio} $tone={tone} />
      </Track>
      <Intro>Must contain the following rules:</Intro>
      <List>
        {RULES.map((rule) => {
          const ok = rules[rule.key];
          return (
            <Item key={rule.key}>
              <Icon
                name={ok ? 'CheckCircle' : 'XCircle'}
                size={16}
                weight="fill"
                color={ok ? 'var(--koala-status-success)' : 'var(--koala-status-danger)'}
              />
              <span>{rule.label}</span>
            </Item>
          );
        })}
      </List>
    </Root>
  );
}

export default PasswordStrength;
