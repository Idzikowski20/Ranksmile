import { render, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { theme, Toggle } from '../../components/core';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('Toggle', () => {
  it('wola onChange po kliknieciu', () => {
    const onChange = jest.fn();
    const { container } = render(<Toggle checked={false} onChange={onChange} />, { wrapper: Wrapper });
    fireEvent.click(container.querySelector('input[type="checkbox"]')!);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
