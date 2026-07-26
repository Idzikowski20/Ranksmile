import React from 'react';
import { render } from '@testing-library/react';
import { BounceSmileyAnimation } from '../../components/pixel-perfect/bounce-smiley-animation';

describe('BounceSmileyAnimation', () => {
  it('wires CSS loop classes for compact animated mark (Surfy-style)', () => {
    const { container } = render(
      <BounceSmileyAnimation compact size={56} entrance={false} />,
    );
    expect(container.querySelector('.smily-face-spin')).not.toBeNull();
    expect(container.querySelector('.smily-eye-blink')).not.toBeNull();
  });

  it('omits CSS loop classes when animateRotate is false', () => {
    const { container } = render(
      <BounceSmileyAnimation compact size={56} animateRotate={false} />,
    );
    expect(container.querySelector('.smily-face-spin')).toBeNull();
    expect(container.querySelector('.smily-eye-blink')).toBeNull();
  });
});
