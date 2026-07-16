import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';

const routerPush = jest.fn();
const routerReplace = jest.fn();

jest.mock('next/router', () => ({
   useRouter: () => ({
      push: routerPush,
      replace: routerReplace,
      prefetch: jest.fn(),
   }),
}));

jest.mock('../../lib/getBootstrap', () => ({
   getBootstrap: jest.fn(),
}));

import Home from '../../pages/index';

describe('Home Page', () => {
   const queryClient = new QueryClient();
   beforeEach(() => {
      routerPush.mockReset();
      routerReplace.mockReset();
      fetchMock.resetMocks();
      localStorage.clear();
   });

   it('redirects unauthenticated visitors to sign-in', async () => {
      fetchMock.mockResponse(async (req) => {
         if (req.url.includes('/api/session/bootstrap')) {
            return { status: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
         }
         return JSON.stringify({});
      });
      render(
         <QueryClientProvider client={queryClient}>
            <Home />
         </QueryClientProvider>,
      );
      await waitFor(() => expect(routerReplace).toHaveBeenCalledWith('/auth/sign-in'));
   });

   it('redirects to the first workspace dashboard', async () => {
      fetchMock.mockResponse(async (req) => {
         if (req.url.includes('/api/session/bootstrap')) {
            return JSON.stringify({
               redirectTo: '/workspace/7/dashboard',
               onboarding: { completed: true },
               email: { confirmed: true, email: null },
               workspaces: [{ id: 7 }],
               activeId: 7,
               role: 'owner',
               setupWorkspaceId: null,
               canCreateSetup: true,
            });
         }
         return JSON.stringify({});
      });
      render(
         <QueryClientProvider client={queryClient}>
            <Home />
         </QueryClientProvider>,
      );
      await waitFor(() => expect(routerReplace).toHaveBeenCalledWith('/workspace/7/dashboard'));
   });
});
