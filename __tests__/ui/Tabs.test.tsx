import { render, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { theme } from '../../components/core/theme';
import Tabs from '../../components/ui/Tabs';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

const items = [ { value: 'a', label: 'Alpha', count: 2 }, { value: 'b', label: 'Beta', count: 5 } ];

describe('Tabs', () => {
  it('renderuje etykiety i liczniki', () => {
    const { getByText } = render(<Tabs items={items} value="a" onChange={() => {}} />, { wrapper: Wrapper });
    expect(getByText('Alpha')).toBeInTheDocument();
    expect(getByText('5')).toBeInTheDocument();
  });
  it('wola onChange z wartoscia taba', () => {
    const onChange = jest.fn();
    const { getByText } = render(<Tabs items={items} value="a" onChange={onChange} />, { wrapper: Wrapper });
    fireEvent.click(getByText('Beta'));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
