import React, { useState } from 'react';
import styled from '@emotion/styled';
import Input from '../../primitives/Input';
import { Chip } from '../chip/chip';
import { semantic } from '../../tokens/semantic';
import { typeface, textScale } from '../../tokens/typography';
import { spacing } from '../../tokens/spacing';

/** Loose format check — the server is the authority on deliverability. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Splits a pasted or typed run of addresses — whitespace, comma and semicolon all separate. */
const SEPARATORS = /[\s,;]+/;

export type EmailTagInputProps = {
  /** Committed addresses (lowercased), rendered as removable chips. */
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Accessible name for the field — the placeholder disappears once typing starts. */
  label?: string;
};

const Root = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
  width: 100%;
  font-family: ${typeface.body};
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.md};
`;

const Error = styled.p`
  margin: 0;
  font-size: ${textScale.xs.fontSize};
  line-height: ${textScale.xs.lineHeight};
  color: ${semantic.status.danger};
`;

/** Type an address, then Enter, space, comma or semicolon turns it into a chip. Blur commits too. */
export function EmailTagInput({
  value,
  onChange,
  placeholder = 'name@company.com',
  disabled = false,
  className,
  label = 'Email address',
}: EmailTagInputProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const errorId = 'email-tag-input-error';

  /**
   * Commits every address in `raw` — a list pasted in one go becomes one chip each,
   * instead of being rejected wholesale as a single malformed address.
   *
   * Addresses are lowercased: the invite API lowercases them too, so `A@x.com` and
   * `a@x.com` would otherwise pass the duplicate check here and mail the same person twice.
   */
  const commit = (raw: string): void => {
    const candidates = raw.split(SEPARATORS).map((part) => part.trim().toLowerCase()).filter(Boolean);
    if (!candidates.length) return;

    const accepted: string[] = [];
    const rejected: string[] = [];
    candidates.forEach((email) => {
      if (!EMAIL_RE.test(email)) {
        rejected.push(email);
        return;
      }
      if (value.includes(email) || accepted.includes(email)) return;
      accepted.push(email);
    });

    if (rejected.length) {
      setError(`"${rejected.join('", "')}" is not a valid email address.`);
      // Keep only what failed in the box so the user can fix it without retyping the rest.
      setDraft(rejected.join(' '));
    } else {
      setError(null);
      setDraft('');
    }
    if (accepted.length) onChange([...value, ...accepted]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    // Space commits too — addresses pasted as a list are usually separated by one.
    // Ignored on an empty draft so a stray space doesn't raise a validation error.
    if (e.key === 'Enter' || e.key === ',' || e.key === ';' || (e.key === ' ' && draft.trim())) {
      e.preventDefault();
      commit(draft);
      return;
    }
    if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <Root className={className}>
      <Input
        type="email"
        size="lg"
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        hasError={Boolean(error)}
        aria-label={label}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => { setDraft(e.target.value); setError(null); }}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
      />
      {error ? <Error id={errorId} role="alert">{error}</Error> : null}
      {value.length > 0 && (
        <Chips>
          {value.map((email) => (
            <Chip
              key={email}
              size="md"
              disabled={disabled}
              onDismiss={() => onChange(value.filter((e) => e !== email))}
            >
              {email}
            </Chip>
          ))}
        </Chips>
      )}
    </Root>
  );
}

export default EmailTagInput;
