import React from 'react';
import { render } from '@testing-library/react';
import { BounceSmileyAnimation } from '../../components/common/BounceSmileyAnimation';

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

  it('smily-wobble CSS uses alternate so the loop does not jump angle', () => {
    // Root cause regression: non-closed keyframes (0° → 100°) + infinite
    // snapped every cycle. alternate (or 0%===100%) keeps motion continuous.
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const css = fs.readFileSync(
      path.join(__dirname, '../../styles/globals.css'),
      'utf8',
    );
    const block = css.match(/\.smily-face-spin\s*\{[^}]+\}/);
    expect(block?.[0] ?? '').toMatch(/infinite\s+alternate|alternate\s+infinite/);
    expect(css).toMatch(/@keyframes smily-wobble[\s\S]*?\bfrom\b[\s\S]*?\bto\b/);
  });
});
