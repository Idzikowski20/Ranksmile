import { render, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { theme } from '../../components/core/theme';
import Button from '../../components/ui/Button';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('Button', () => {
  it('renderuje dzieci i wola onClick', () => {
    const onClick = jest.fn();
    const { getByText } = render(<Button onClick={onClick}>Save</Button>, { wrapper: Wrapper });
    fireEvent.click(getByText('Save'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it('disabled blokuje onClick', () => {
    const onClick = jest.fn();
    const { getByText } = render(<Button onClick={onClick} disabled>Disabled</Button>, { wrapper: Wrapper });
    fireEvent.click(getByText('Disabled'));
    expect(onClick).not.toHaveBeenCalled();
  });
  it('renderuje warianty bez bledu', () => {
    const { getByText } = render(
      <>
        <Button variant="primary">P</Button>
        <Button variant="secondary">S</Button>
        <Button variant="ghost">G</Button>
      </>,
      { wrapper: Wrapper }
    );
    expect(getByText('P')).toBeInTheDocument();
    expect(getByText('S')).toBeInTheDocument();
    expect(getByText('G')).toBeInTheDocument();
  });
});
