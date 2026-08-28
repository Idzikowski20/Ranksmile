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

jest.mock('@/src/infrastructure/getBootstrap', () => ({
   getBootstrap: jest.fn(),
}));

// The landing lazy-loads GSAP; jsdom has no layout, so opt out like a reduced-motion user.
jest.mock('../../lib/motion/gsap', () => ({
   prefersReducedMotion: () => true,
   registerMotionPlugins: jest.fn(),
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

   it('renders the public landing page when the server found no session', async () => {
      const { findByRole, container } = render(
         <QueryClientProvider client={queryClient}>
            <Home landing />
         </QueryClientProvider>,
      );
      const title = await findByRole('heading', { level: 1 });
      expect(title.textContent).toMatch(/Be The Answer in/i);
      expect(container.querySelector('[data-landing-root]')).not.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(routerReplace).not.toHaveBeenCalled();
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

   // "/" is Public, so ApplicationShell never gates it — this page is its own
   // dispatcher, and following the BILLING_REQUIRED redirect here bounced an expired
   // customer onto the pricing page with no word of why. The expiry block renders in
   // place instead, exactly as the shell does on every other route.
   it('shows the expiry block instead of bouncing an expired customer to /plans', async () => {
      fetchMock.mockResponse(async (req) => {
         if (req.url.includes('/api/session/bootstrap')) {
            return JSON.stringify({
               onboarding: { completed: true },
               email: { confirmed: true, email: null },
               workspaces: [{ id: 7 }],
               access: {
                  appState: 'BILLING_REQUIRED',
                  reason: 'NO_ACTIVE_ENTITLEMENT',
                  billing: { state: 'NONE', everSubscribed: true },
                  workspace: { state: 'READY' },
                  redirect: { redirect: '/plans', replace: true, reason: 'NO_ACTIVE_ENTITLEMENT' },
               },
            });
         }
         return JSON.stringify({});
      });
      const { findByText } = render(
         <QueryClientProvider client={queryClient}>
            <Home />
         </QueryClientProvider>,
      );
      await findByText(/expired/i);
      expect(routerReplace).not.toHaveBeenCalled();
   });
});
