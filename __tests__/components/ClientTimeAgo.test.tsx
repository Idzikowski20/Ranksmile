import React from 'react';
import { render, screen, act } from '@testing-library/react';
import ClientTimeAgo from '@/components/common/ClientTimeAgo';

describe('ClientTimeAgo', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renders the relative time after mount', () => {
    const d = new Date(Date.now() - 5 * 60_000).toISOString();
    render(<ClientTimeAgo date={d} />);
    expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
  });

  it('keeps refreshing as time passes', () => {
    const d = new Date(Date.now() - 60_000).toISOString();
    render(<ClientTimeAgo date={d} />);
    expect(screen.getByText('1 minute ago')).toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(5 * 60_000); });
    expect(screen.getByText('6 minutes ago')).toBeInTheDocument();
  });

  it('stops its timer on unmount', () => {
    const d = new Date(Date.now() - 60_000).toISOString();
    const { unmount } = render(<ClientTimeAgo date={d} />);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
