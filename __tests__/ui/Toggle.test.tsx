import { render, fireEvent } from '@testing-library/react';
import Toggle from '../../components/ui/Toggle';
describe('Toggle', () => {
  it('woła onChange po kliknięciu', () => {
    const onChange = jest.fn();
    const { container } = render(<Toggle checked={false} onChange={onChange} />);
    fireEvent.click(container.firstChild as Element);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
