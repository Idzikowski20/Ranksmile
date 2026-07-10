/** @jest-environment jsdom */
import React from 'react';
import { render } from '@testing-library/react';
import TopProgressBar from '../../components/common/TopProgressBar';

const mockEvents: Record<string, Array<(...args: unknown[]) => void>> = {
  on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
    mockEvents[event] = mockEvents[event] ?? [];
    mockEvents[event].push(cb);
  }),
  off: jest.fn(),
};

jest.mock('next/router', () => ({
  useRouter: () => ({
    events: mockEvents,
    isReady: true,
  }),
}));

describe('TopProgressBar', () => {
  it('renders a thin overlay, not a full-height block', () => {
    const { container } = render(<TopProgressBar />);
    const bar = container.querySelector('.top-progress-bar');
    expect(bar).not.toBeNull();
    expect(bar).toHaveStyle({ height: '2px', maxHeight: '2px', overflow: 'hidden' });
  });
});
