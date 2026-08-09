import React from 'react';
import { render } from '@testing-library/react';
import { BounceSmileyAnimation } from '../../components/common/BounceSmileyAnimation';

/** The mouth is the only path carrying a stroke, so it is findable without a testid. */
function mouthPath(container: HTMLElement): string {
  const el = container.querySelector('path[stroke="#057BC9"]');
  return el?.getAttribute('d') ?? '';
}

describe('BounceSmileyAnimation mood', () => {
  it('smiles by default — control points below the endpoints', () => {
    const { container } = render(<BounceSmileyAnimation compact size={56} animateRotate={false} />);
    expect(mouthPath(container)).toBe('M90 127C97.2727 139 112.727 139 120 127');
  });

  it('frowns when asked — the same arc mirrored about y=130', () => {
    const { container } = render(
      <BounceSmileyAnimation compact size={56} animateRotate={false} mood="sad" />,
    );
    expect(mouthPath(container)).toBe('M90 133C97.2727 121 112.727 121 120 133');
  });

  // 12 call sites render this mark without a mood; none of them may start frowning.
  it('leaves every existing call site smiling', () => {
    const { container } = render(<BounceSmileyAnimation />);
    expect(mouthPath(container)).toContain('C97.2727 139');
  });
});
