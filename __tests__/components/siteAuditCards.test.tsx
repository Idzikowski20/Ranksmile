import { render, screen, fireEvent } from '@testing-library/react';
import { TickRingWidget } from '../../components/koala/product/TickRingWidget';
import SiteSpeedCard from '../../components/siteAudit/SiteSpeedCard';

describe('TickRingWidget', () => {
  const segments = [
    { id: 'healthy', label: 'Healthy', value: 1, color: '#1' },
    { id: 'issues', label: 'Have issues', value: 21, color: '#2' },
    { id: 'blocked', label: 'Blocked', value: 0, color: '#3' },
  ];

  it('draws the ring, the total, and a legend row per segment with its count', () => {
    const { container } = render(<TickRingWidget title="Site Health" value="80" caption="Score" segments={segments} ticks={60} />);
    expect(container.querySelectorAll('svg line')).toHaveLength(60);
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('Score')).toBeInTheDocument();
    expect(screen.getByText('Have issues').nextSibling?.textContent).toBe('21');
    expect(screen.getByText('Blocked').nextSibling?.textContent).toBe('0');
  });

  it('links the documentation from the subtitle and the menu', () => {
    render(<TickRingWidget title="Site Health" value="80" segments={segments} docHref="https://docs.example" />);
    const links = screen.getAllByRole('link');
    expect(links.every((l) => l.getAttribute('href') === 'https://docs.example')).toBe(true);
    expect(screen.getByText(/To learn about site health/)).toBeInTheDocument();
  });

  it('shows the empty label instead of a legend when nothing has a value', () => {
    render(<TickRingWidget title="Site Health" value="0" segments={[{ id: 'a', label: 'A', value: 0, color: '#1' }]} emptyLabel="No crawled pages yet." />);
    expect(screen.getByText('No crawled pages yet.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});

describe('SiteSpeedCard', () => {
  const speed = { score: 87, lcpMs: 2540, tbtMs: 885, cls: 0.004, speedIndexMs: 2540, url: 'https://x.pl', measuredAt: '2026-09-16T10:00:00Z' };

  it('shows the score, the verdict and the four metrics', () => {
    render(<SiteSpeedCard speed={speed} enabled />);
    expect(screen.getByText('87')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByText('Load Time').nextSibling?.textContent).toBe('2.54s');
    expect(screen.getByText('Interactivity').nextSibling?.textContent).toBe('0.89s');
    expect(screen.getByText('Visual Stability').nextSibling?.textContent).toBe('0.0');
    expect(screen.getByText('Animation Load').nextSibling?.textContent).toBe('2.54s');
  });

  it('offers to measure when nothing has been measured, and runs it on click', () => {
    const onMeasure = jest.fn();
    render(<SiteSpeedCard speed={null} enabled onMeasure={onMeasure} />);
    expect(screen.getByText('Not measured yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Measure now' }));
    expect(onMeasure).toHaveBeenCalled();
  });

  it('explains what is missing when the API key is not configured', () => {
    render(<SiteSpeedCard speed={null} enabled={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/PAGESPEED_API_KEY/)).toBeInTheDocument();
  });

  it('disables the button and says how long while measuring', () => {
    render(<SiteSpeedCard speed={speed} enabled measuring />);
    expect(screen.getByRole('button', { name: /Measuring/ })).toBeDisabled();
  });
});
