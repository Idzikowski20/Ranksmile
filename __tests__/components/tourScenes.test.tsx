import React from 'react';
import { render, screen } from '@testing-library/react';
import * as scenes from '../../components/onboarding/tourScenes';

type SceneFn = (props: { accent: string }) => JSX.Element;

const ALL = Object.entries(scenes).filter(
  (e): e is [string, SceneFn] => typeof e[1] === 'function' && e[0].endsWith('Scene'),
);

describe('tour scenes', () => {
  it('exports one scene per tour step', () => {
    expect(ALL).toHaveLength(17);
  });

  /**
   * The GSAP intro runs on mount and touches SVG APIs jsdom does not implement
   * (getTotalLength). A throw here would escape into GuidedTour and take the whole
   * tour down, so every scene has to survive a bare mount.
   */
  it.each(ALL)('%s mounts without throwing', (_name, SceneComponent) => {
    expect(() => render(<SceneComponent accent="#F84416" />)).not.toThrow();
  });

  it('keeps its labels and numbers in the DOM, so the rest state reads correctly', () => {
    render(<scenes.KeywordTrackingScene accent="#F84416" />);
    expect(screen.getByText('Pos')).toBeInTheDocument();
    expect(screen.getByText('Chg')).toBeInTheDocument();
    // Positions — the column the page exists to show. (Values that also occur as a
    // delta, like 3, are ambiguous by text alone, so assert the unambiguous ones.)
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it.each(ALL)('%s keeps an ambient loop running, not just an entrance', (_name, SceneComponent) => {
    const { container } = render(<SceneComponent accent="#F84416" />);
    expect(container.querySelectorAll('[data-loop]').length).toBeGreaterThan(0);
  });

  /**
   * Gauge arcs encode their value as the first number in `stroke-dasharray`. An
   * entrance that animates the array itself (rather than only the offset) leaves every
   * gauge drawn as a full ring, silently turning 78 into 100.
   */
  it('leaves gauge arcs at their partial value after the entrance runs', () => {
    const { container } = render(<scenes.SiteAuditScene accent="#F84416" />);
    const arcs = container.querySelectorAll('[data-anim="arc"]');
    expect(arcs.length).toBeGreaterThan(0);
    arcs.forEach((arc) => {
      const [visible, total] = (arc.getAttribute('stroke-dasharray') ?? '').split(' ').map(Number);
      expect(visible).toBeGreaterThan(0);
      expect(visible).toBeLessThan(total);
    });
  });

  it('renders count-up targets at their final value before any tween runs', () => {
    render(<scenes.DashboardScene accent="#F84416" />);
    // gsap.from/to semantics: what ships in the markup is the finished number, so a
    // scene that never animates still shows 1,596 rather than 0.
    expect(screen.getByText('1,596')).toBeInTheDocument();
  });
});
