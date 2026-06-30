import { screen } from '@testing-library/react';
import Sidebar from '../../components/common/Sidebar';
import { dummyDomain } from '../../__mocks__/data';
import { renderWithClient } from '../../__mocks__/utils';

const addDomainMock = jest.fn();
jest.mock('next/router', () => jest.requireActual('next-router-mock'));

describe('Sidebar Component', () => {
   it('renders without crashing', async () => {
       renderWithClient(<Sidebar domains={[dummyDomain]} showAddModal={addDomainMock} />);
       expect(screen.getByTestId('sidebar')).toBeInTheDocument();
   });
   it('renders the primary navigation', async () => {
      renderWithClient(<Sidebar domains={[dummyDomain]} showAddModal={addDomainMock} />);
      expect(screen.getByLabelText('Dashboard')).toBeInTheDocument();
      expect(screen.getByLabelText('Content Editor')).toBeInTheDocument();
   });
   it('links the Dashboard nav item to the dashboard route', async () => {
      renderWithClient(<Sidebar domains={[dummyDomain]} showAddModal={addDomainMock} />);
      const dashboardLink = screen.getByLabelText('Dashboard');
      expect(dashboardLink).toHaveAttribute('href', expect.stringContaining('/dashboard'));
   });
});
