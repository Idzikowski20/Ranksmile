/** @jest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react';
import { useArticleChannel } from '../../lib/ably/useArticleChannel';

const mockClose = jest.fn();
const mockOff = jest.fn();
const mockOn = jest.fn();
const mockGet = jest.fn(() => ({}));

jest.mock('ably', () => ({
  Realtime: jest.fn().mockImplementation(() => ({
    connection: {
      on: mockOn,
      off: mockOff,
      state: 'connected',
    },
    channels: { get: mockGet },
    close: mockClose,
  })),
}));

describe('useArticleChannel teardown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClose.mockImplementation(() => Promise.reject(new Error('Connection closed')));
  });

  it('closes the client on unmount without throwing', async () => {
    const { unmount } = renderHook(() => useArticleChannel({ articleId: 42 }));
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(() => unmount()).not.toThrow();
    await waitFor(() => expect(mockClose).toHaveBeenCalled());
  });

  it('exposes the channel only when connected', async () => {
    mockOn.mockImplementation((handler: (change: { current: string }) => void) => {
      handler({ current: 'connected' });
    });
    const { result } = renderHook(() => useArticleChannel({ articleId: 7 }));
    await waitFor(() => expect(result.current.channel).not.toBeNull());
    expect(result.current.connectionState).toBe('connected');
  });
});
