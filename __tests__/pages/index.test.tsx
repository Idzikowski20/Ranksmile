import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import Home from '../../pages/index';

const routerPush = jest.fn();
const routerReplace = jest.fn();
jest.mock('next/router', () => ({
   useRouter: () => ({
      push: routerPush,
      replace: routerReplace,
      prefetch: jest.fn(),
   }),
}));

describe('Home Page', () => {
   const queryClient = new QueryClient();
   beforeEach(() => {
      routerPush.mockReset();
      routerReplace.mockReset();
      fetchMock.resetMocks();
      localStorage.clear();
   });

   it('Renders without crashing', async () => {
      fetchMock.mockResponse(JSON.stringify({ workspaces: [] }));
      render(
          <QueryClientProvider client={queryClient}>
              <Home />
          </QueryClientProvider>,
      );
      // console.log(prettyDOM(renderer.container.firstChild));
      expect(await screen.findByRole('main')).toBeInTheDocument();
      expect(screen.queryByText('Add Domain')).not.toBeInTheDocument();
   });
   it('Should redirect to the first workspace dashboard.', async () => {
       fetchMock.mockResponse(async (req) => {
          if (req.url.includes('/api/workspaces')) {
             return JSON.stringify({ workspaces: [{ id: 7, name: 'idztech.pl' }] });
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
