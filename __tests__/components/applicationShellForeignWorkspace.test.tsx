import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { ApplicationShell } from '@/src/infrastructure/appAccess/ApplicationShell';

const mockRefetch = jest.fn();
const bootstrap = {
  workspaces: [{ id: 2, name: 'A' }],
  activeId: 2,
  setupWorkspaceId: null,
  access: { appState: 'READY', reason: 'ENTITLED_WITH_READY_WORKSPACE', redirect: { redirect: '/workspace/2/dashboard', replace: true } },
  onboarding: { completed: true },
};

jest.mock('next/router', () => ({
  useRouter: () => ({ asPath: '/workspace/7/articles', pathname: '/articles', replace: jest.fn(), push: jest.fn() }),
}));
jest.mock('react-query', () => ({
  useQuery: () => ({
    data: bootstrap, isLoading: false, isFetched: true, isError: false, isFetching: false, refetch: mockRefetch,
  }),
}));
jest.mock('@/src/infrastructure/http/fetchBootstrap', () => ({ fetchBootstrapOrNull: jest.fn() }));
jest.mock('@/src/infrastructure/config/isPublicPath', () => ({ isPublicRoute: () => false }));
jest.mock('@/components/billing/PlanExpired', () => ({ PlanExpired: () => null }));
jest.mock('@/src/infrastructure/billing/billingAuditShared', () => ({ logOnboardingRedirect: jest.fn() }));
jest.mock('@/components/common/AppLoading', () => ({ __esModule: true, default: () => <div>loading</div> }));
jest.mock('@/src/infrastructure/appAccess/index', () => ({
  allowsFrontend: () => true,
  emitAccessTimeline: jest.fn(),
  redirectLoopKey: () => 'k',
}));

const replace = jest.fn();
beforeAll(() => {
  Object.defineProperty(window, 'location', { value: { ...window.location, replace }, writable: true });
});
beforeEach(() => {
  jest.useFakeTimers();
  replace.mockReset();
  mockRefetch.mockReset();
});
afterEach(() => jest.useRealTimers());

it('does not redirect on a failed confirmation, and retries', async () => {
  mockRefetch
    .mockResolvedValueOnce({ isError: true, data: bootstrap })
    .mockResolvedValueOnce({ isError: false, data: bootstrap });
  render(<ApplicationShell><div>app</div></ApplicationShell>);
  expect(screen.getByText('loading')).toBeTruthy();
  await act(async () => { await Promise.resolve(); });
  expect(replace).not.toHaveBeenCalled();

  await act(async () => { jest.advanceTimersByTime(1500); await Promise.resolve(); });
  expect(mockRefetch).toHaveBeenCalledTimes(2);
  expect(replace).toHaveBeenCalledWith('/workspace/2/articles');
});

it('does not redirect when the fresh bootstrap includes the workspace', async () => {
  mockRefetch.mockResolvedValueOnce({ isError: false, data: { ...bootstrap, workspaces: [{ id: 2 }, { id: 7 }] } });
  render(<ApplicationShell><div>app</div></ApplicationShell>);
  await act(async () => { await Promise.resolve(); });
  expect(replace).not.toHaveBeenCalled();
});
