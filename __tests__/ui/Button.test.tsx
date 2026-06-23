import { render, fireEvent } from '@testing-library/react';
import Button from '../../components/ui/Button';

describe('Button', () => {
  it('renderuje dzieci i woła onClick', () => {
    const onClick = jest.fn();
    const { getByText } = render(<Button onClick={onClick}>Save</Button>);
    fireEvent.click(getByText('Save'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it('disabled blokuje onClick', () => {
    const onClick = jest.fn();
    const { getByText } = render(<Button onClick={onClick} disabled>Disabled</Button>);
    fireEvent.click(getByText('Disabled'));
    expect(onClick).not.toHaveBeenCalled();
  });
  it('renderuje warianty bez błędu', () => {
    const { getByText } = render(
      <>
        <Button variant="primary">P</Button>
        <Button variant="secondary">S</Button>
        <Button variant="ghost">G</Button>
      </>,
    );
    expect(getByText('P')).toBeInTheDocument();
    expect(getByText('S')).toBeInTheDocument();
    expect(getByText('G')).toBeInTheDocument();
  });
});
