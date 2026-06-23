import { render, fireEvent } from '@testing-library/react';
import Tabs from '../../components/ui/Tabs';
const items = [ { value: 'a', label: 'Alpha', count: 2 }, { value: 'b', label: 'Beta', count: 5 } ];
describe('Tabs', () => {
  it('renderuje etykiety i liczniki', () => {
    const { getByText } = render(<Tabs items={items} value="a" onChange={() => {}} />);
    expect(getByText('Alpha')).toBeInTheDocument();
    expect(getByText('5')).toBeInTheDocument();
  });
  it('woła onChange z wartością taba', () => {
    const onChange = jest.fn();
    const { getByText } = render(<Tabs items={items} value="a" onChange={onChange} />);
    fireEvent.click(getByText('Beta'));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
