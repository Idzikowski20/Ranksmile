import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmailTagInput } from '../../components/koala/core/emailTagInput/emailTagInput';

/** Wrapper that owns the value, so committed chips actually render. */
const Harness = ({ onValue }: { onValue: (v: string[]) => void }) => {
  const [value, setValue] = useState<string[]>([]);
  return (
    <EmailTagInput
      label="Teammate email address"
      value={value}
      onChange={(next) => { setValue(next); onValue(next); }}
    />
  );
};

const field = () => screen.getByLabelText('Teammate email address');

const typeAndBlur = (text: string) => {
  fireEvent.change(field(), { target: { value: text } });
  fireEvent.blur(field());
};

describe('EmailTagInput', () => {
  it('turns a pasted list into one chip per address', () => {
    const onValue = jest.fn();
    render(<Harness onValue={onValue} />);
    typeAndBlur('a@example.com, b@example.com c@example.com');
    expect(onValue).toHaveBeenCalledWith(['a@example.com', 'b@example.com', 'c@example.com']);
  });

  it('lowercases addresses so case variants are not invited twice', () => {
    const onValue = jest.fn();
    render(<Harness onValue={onValue} />);
    typeAndBlur('Person@Example.com PERSON@example.com');
    expect(onValue).toHaveBeenCalledWith(['person@example.com']);
  });

  it('keeps only the invalid part in the box and reports it', () => {
    const onValue = jest.fn();
    render(<Harness onValue={onValue} />);
    typeAndBlur('good@example.com nope');
    expect(onValue).toHaveBeenCalledWith(['good@example.com']);
    expect(screen.getByRole('alert')).toHaveTextContent('"nope" is not a valid email address.');
    expect(field()).toHaveValue('nope');
    expect(field()).toHaveAttribute('aria-invalid', 'true');
  });
});
