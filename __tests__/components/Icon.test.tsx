import React from 'react';
import { render } from '@testing-library/react';
import * as Phosphor from '@phosphor-icons/react';
import Icon from '@/components/common/Icon';

/**
 * components/common/Icon maps legacy `type` strings onto Koala/Phosphor icon names.
 * Koala's Icon renders null for an unknown name, so a typo is a silent blank icon
 * that nothing else would catch.
 */
const TYPES = [
  'logo', 'loading', 'menu', 'close', 'download', 'trash', 'edit', 'check', 'error',
  'question', 'caret-left', 'caret-right', 'caret-down', 'caret-up', 'search',
  'settings', 'settings-alt', 'logout', 'reload', 'dots', 'hamburger', 'star',
  'star-filled', 'link', 'link-alt', 'clock', 'sort', 'desktop', 'mobile', 'tags',
  'filter', 'idea', 'tracking', 'google', 'adwords', 'keywords', 'integration',
  'cursor', 'eye', 'eye-closed', 'target', 'help', 'date', 'email', 'scraper',
  'city', 'research', 'domains', 'lock', 'image',
];

describe('Icon Component', () => {
  it('renders without crashing', async () => {
    render(<Icon type="logo" size={24} />);
    expect(document.querySelector('svg')).toBeInTheDocument();
  });
});

describe('common/Icon', () => {
  it.each(TYPES)('renders a glyph for type "%s"', (type) => {
    const { container } = render(<Icon type={type} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('falls back to a glyph for an unknown type', () => {
    const { container } = render(<Icon type="definitely-not-an-icon" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('every mapped Phosphor name is a real export', () => {
    // Guards against a name that exists as a dist file but is not exported.
    const names = ['CircleNotch', 'List', 'X', 'DownloadSimple', 'Trash', 'PencilSimple',
      'Check', 'Warning', 'Question', 'QuestionMark', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp',
      'MagnifyingGlass', 'Gear', 'SignOut', 'ArrowsClockwise', 'DotsThree', 'Star', 'Link',
      'LinkSimple', 'Clock', 'ArrowsDownUp', 'Desktop', 'DeviceMobile', 'Tag', 'Funnel',
      'Lightbulb', 'ChartLine', 'GoogleLogo', 'Megaphone', 'Cursor', 'Eye', 'EyeSlash',
      'Target', 'Calendar', 'Envelope', 'Robot', 'Buildings', 'Lock', 'Image'];
    const missing = names.filter((n) => !(Phosphor as Record<string, unknown>)[n]);
    expect(missing).toEqual([]);
  });
});
