import React, { useState } from 'react';
import styled from '@emotion/styled';
import Input from '../../primitives/Input';
import { Chip } from '../chip/chip';
import { semantic } from '../../tokens/semantic';
import { typeface, textScale } from '../../tokens/typography';
import { spacing } from '../../tokens/spacing';

/** Loose format check — the server is the authority on deliverability. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailTagInputProps = {
  /** Committed addresses, rendered as removable chips. */
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
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
  value, onChange, placeholder = 'name@company.com', disabled = false, className,
}: EmailTagInputProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const commit = (raw: string): void => {
    const email = raw.trim().replace(/[,;]$/, '');
    if (!email) return;
    if (!EMAIL_RE.test(email)) {
      setError(`"${email}" is not a valid email address.`);
      return;
    }
    if (value.includes(email)) {
      setError(`${email} is already on the list.`);
      return;
    }
    setError(null);
    setDraft('');
    onChange([...value, email]);
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
        onChange={(e) => { setDraft(e.target.value); setError(null); }}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
      />
      {error ? <Error role="alert">{error}</Error> : null}
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
