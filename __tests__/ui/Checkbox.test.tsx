import { render, fireEvent } from '@testing-library/react';
import Checkbox from '../../components/ui/Checkbox';

describe('Checkbox', () => {
  it('woła onChange po kliknięciu', () => {
    const onChange = jest.fn();
    const { container } = render(<Checkbox checked={false} onChange={onChange} />);
    fireEvent.click(container.querySelector('.rec-cb-wrap')!);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
  it('odzwierciedla stan checked', () => {
    const { container } = render(<Checkbox checked onChange={() => {}} />);
    expect((container.querySelector('input') as HTMLInputElement).checked).toBe(true);
  });
  it('ustawia natywny stan indeterminate (najłatwiej zepsuć przy refaktorze)', () => {
    const { container } = render(<Checkbox checked={false} indeterminate onChange={() => {}} />);
    expect((container.querySelector('input') as HTMLInputElement).indeterminate).toBe(true);
  });
});
