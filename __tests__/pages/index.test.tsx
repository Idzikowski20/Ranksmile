import { render, screen, waitFor } from '@testing-library/react';
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

jest.mock('next/dynamic', () => () => function MockDigitX() {
   return (
      <main role="main">
         <h1>Digital Solutions</h1>
      </main>
   );
});

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

   it('Renders marketing homepage without crashing', async () => {
      render(
          <QueryClientProvider client={queryClient}>
              <Home marketing={true} />
          </QueryClientProvider>,
      );
      expect(await screen.findByText(/Digital Solutions/i)).toBeInTheDocument();
   });
   it('Should redirect to the first workspace dashboard.', async () => {
       fetchMock.mockResponse(async (req) => {
          if (req.url.includes('/api/session/bootstrap')) {
             return JSON.stringify({ redirectTo: '/workspace/7/dashboard', onboarding: { completed: true }, email: { confirmed: true, email: null }, workspaces: [{ id: 7 }], activeId: 7, role: 'owner', setupWorkspaceId: null, canCreateSetup: true });
          }
          return JSON.stringify({});
       });
       render(
           <QueryClientProvider client={queryClient}>
               <Home marketing={false} />
           </QueryClientProvider>,
       );
       await waitFor(() => expect(routerReplace).toHaveBeenCalledWith('/workspace/7/dashboard'));
   });
});
