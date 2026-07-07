import { render } from '@testing-library/react';
import { Gauge } from '../../components/core';

// Celujemy w data-testid="gauge-score" (nie querySelector('text')) — w wariancie lg pojawi się wiele <text>.
describe('Gauge sm (pierścień)', () => {
  it('renderuje zaokrąglony score jako tekst', () => {
    const { getByTestId } = render(<Gauge score={61} size="sm" />);
    expect(getByTestId('gauge-score')).toHaveTextContent('61');
  });
  it('koloruje wg kanonu 33/66 — zielony dla 80', () => {
    const { getByTestId } = render(<Gauge score={80} size="sm" />);
    expect(getByTestId('gauge-score').getAttribute('fill')).toBe('#1ab25e');
  });
  it('koloruje na czerwono dla 20', () => {
    const { getByTestId } = render(<Gauge score={20} size="sm" />);
    expect(getByTestId('gauge-score').getAttribute('fill')).toBe('#d70028');
  });
});

describe('Gauge lg/md (półokrąg)', () => {
  it('renderuje svg bez błędu dla lg', () => {
    const { container } = render(<Gauge score={61} size="lg" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
