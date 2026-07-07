import { render, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { theme, Checkbox } from '../../components/core';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('Checkbox', () => {
  it('wola onChange po kliknieciu', () => {
    const onChange = jest.fn();
    const { container } = render(<Checkbox checked={false} onChange={onChange} />, { wrapper: Wrapper });
    fireEvent.click(container.querySelector('label')!);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
  it('odzwierciedla stan checked', () => {
    const { container } = render(<Checkbox checked onChange={() => {}} />, { wrapper: Wrapper });
    expect((container.querySelector('input') as HTMLInputElement).checked).toBe(true);
  });
  it('ustawia natywny stan indeterminate', () => {
    const { container } = render(<Checkbox checked="indeterminate" onChange={() => {}} />, { wrapper: Wrapper });
    expect((container.querySelector('input') as HTMLInputElement).indeterminate).toBe(true);
  });
});
