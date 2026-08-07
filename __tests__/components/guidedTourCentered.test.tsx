import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GuidedTour } from '../../components/koala/product/GuidedTour';

const steps = [
  { id: 'a', title: 'Dashboard', body: 'What this page is for.', illustration: <div data-testid="scene-a" /> },
  { id: 'b', title: 'Performance', body: 'Second page.', illustration: <div data-testid="scene-b" /> },
];

describe('GuidedTour centered steps', () => {
  beforeEach(() => localStorage.clear());

  it('renders selector-less steps as a centered dialog with the illustration slot', () => {
    render(<GuidedTour open steps={steps} onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByTestId('scene-a')).toBeInTheDocument();
  });

  /**
   * Centring must be real pixels, not `translate(-50%, -50%)`: popoverMotion animates
   * `transform` with fill-mode `both`, so its closing `translateY(0)` outranks an inline
   * transform and leaves the card's top-left corner at the viewport centre — most of the
   * card off-screen. Asserting the inline style alone missed this, so assert the shape.
   */
  it('centres with computed offsets that no animation can override', () => {
    render(<GuidedTour open steps={steps} onClose={() => {}} />);
    const card = screen.getByRole('dialog', { name: 'Dashboard' });
    expect(card.style.transform).toBe('');
    expect(card.style.top).toMatch(/^\d+px$/);
    expect(card.style.left).toMatch(/^\d+px$/);
  });

  it('ignores backdrop clicks — a stray click must not dismiss and persist the tour', () => {
    const onClose = jest.fn();
    render(<GuidedTour open steps={steps} onClose={onClose} storageKey="page_tour_seen" />);
    fireEvent.click(screen.getByTestId('tour-backdrop'));
    expect(onClose).not.toHaveBeenCalled();
    expect(localStorage.getItem('page_tour_seen')).toBeNull();
  });

  it('blocks pointer events on the app underneath for both step variants', async () => {
    const target = document.createElement('div');
    target.setAttribute('data-tour', 'nav-dashboard');
    document.body.appendChild(target);
    try {
      const { unmount } = render(<GuidedTour open steps={steps} onClose={() => {}} />);
      // Centered step: the full-viewport overlay swallows clicks.
      expect(getComputedStyle(screen.getByTestId('tour-overlay')).pointerEvents).toBe('auto');
      unmount();

      // Anchored step: same overlay, so the spotlighted element is not clickable either.
      render(
        <GuidedTour open steps={[{ ...steps[0], selector: '[data-tour="nav-dashboard"]' }]} onClose={() => {}} />,
      );
      await waitFor(() => expect(screen.getByRole('dialog', { name: 'Dashboard' }).style.transform).toBe(''));
      expect(getComputedStyle(screen.getByTestId('tour-overlay')).pointerEvents).toBe('auto');
    } finally {
      target.remove();
    }
  });

  it('traps Tab inside the card so focus cannot reach the blocked app behind it', () => {
    const outside = document.createElement('button');
    outside.textContent = 'app button';
    document.body.appendChild(outside);
    try {
      render(<GuidedTour open steps={steps} onClose={() => {}} />);
      const card = screen.getByRole('dialog', { name: 'Dashboard' });
      expect(card).toHaveFocus();

      // Wraps at the end instead of walking out into the page.
      const last = screen.getByText('Next');
      last.focus();
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(screen.getByText('Skip')).toHaveFocus();

      // Shift+Tab off the first control wraps to the last, not backwards out.
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(last).toHaveFocus();

      // Focus that escaped (e.g. programmatically) is pulled back in on the next Tab.
      outside.focus();
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(outside).not.toHaveFocus();
      expect(card.contains(document.activeElement)).toBe(true);
    } finally {
      outside.remove();
    }
  });

  it('treats Escape as Skip — closes and persists, never leaving the tour pending', () => {
    const onClose = jest.fn();
    render(<GuidedTour open steps={steps} onClose={onClose} storageKey="page_tour_seen" />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(localStorage.getItem('page_tour_seen')).toBe('1');
  });

  it('anchors to the selector target (no centering transform) and keeps the illustration', async () => {
    const target = document.createElement('div');
    target.setAttribute('data-tour', 'nav-dashboard');
    document.body.appendChild(target);
    try {
      render(
        <GuidedTour
          open
          steps={[{ ...steps[0], selector: '[data-tour="nav-dashboard"]' }]}
          onClose={() => {}}
        />,
      );
      // Measured a frame after scrollIntoView, so the anchored position lands async.
      await waitFor(() => expect(screen.getByRole('dialog', { name: 'Dashboard' }).style.transform).toBe(''));
      expect(screen.getByTestId('scene-a')).toBeInTheDocument();
    } finally {
      target.remove();
    }
  });

  it('pages Next/Back through steps and persists the storage key on Done', () => {
    const onClose = jest.fn();
    render(<GuidedTour open steps={steps} onClose={onClose} storageKey="page_tour_seen" />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByTestId('scene-b')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByTestId('scene-a')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalled();
    expect(localStorage.getItem('page_tour_seen')).toBe('1');
  });
});
