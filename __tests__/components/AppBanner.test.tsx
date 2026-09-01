import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppBanner, AppBannerProvider, useAppBanner, type AppBannerState } from '../../components/koala/shell/AppBanner';

function Publisher({ banner }: { banner: AppBannerState | null }) {
  useAppBanner(banner);
  return null;
}

function Harness({ banner }: { banner: AppBannerState | null }) {
  return (
    <AppBannerProvider>
      <AppBanner />
      <Publisher banner={banner} />
    </AppBannerProvider>
  );
}

describe('AppBanner', () => {
  it('renders nothing when no banner is set', () => {
    const { container } = render(<Harness banner={null} />);
    expect(container.querySelector('.koala-app-banner')).toBeNull();
  });

  it('shows message and action link', () => {
    render(<Harness banner={{ message: 'Connect WordPress', action: { label: 'Open settings', href: '/settings/wordpress' } }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Connect WordPress');
    expect(screen.getByRole('link', { name: /Open settings/ })).toHaveAttribute('href', '/settings/wordpress');
  });

  it('clears when the publisher passes null', () => {
    const { rerender, container } = render(<Harness banner={{ message: 'Boom' }} />);
    expect(container.querySelector('.koala-app-banner')).not.toBeNull();
    rerender(<Harness banner={null} />);
    expect(container.querySelector('.koala-app-banner')).toBeNull();
  });

  it('close button only exists when dismissible, and hides the bar', () => {
    const { container, rerender } = render(<Harness banner={{ message: 'Blocking error' }} />);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();

    rerender(<Harness banner={{ message: 'Heads up', dismissible: true }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(container.querySelector('.koala-app-banner')).toBeNull();
  });

  it('persists dismissal across remounts when persistDismiss is set', () => {
    localStorage.clear();
    const banner: AppBannerState = {
      message: 'Ranksmile jest teraz dostępny w języku polskim.',
      dismissible: true,
      persistDismiss: true,
      dismissKey: 'locale-pl-announcement',
    };

    const first = render(<Harness banner={banner} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(first.container.querySelector('.koala-app-banner')).toBeNull();
    first.unmount();

    const second = render(<Harness banner={banner} />);
    expect(second.container.querySelector('.koala-app-banner')).toBeNull();
  });

  /**
   * Two consumers can be mounted at once — a page and a wizard inside it — and their
   * banners can serialise identically. Cleanup used to call setBanner(null) whatever was
   * showing, so unmounting one wiped the other's; comparing by VALUE would not have fixed
   * it either, which is why the hook holds the object it published and compares by
   * identity.
   */
  it('keeps the surviving consumer banner when an identical one unmounts', () => {
    const same: AppBannerState = { message: 'Ten sam komunikat', variant: 'error' };

    const { rerender } = render(
      <AppBannerProvider>
        <AppBanner />
        <Publisher banner={same} />
        <Publisher banner={same} />
      </AppBannerProvider>,
    );
    expect(screen.getByText('Ten sam komunikat')).toBeInTheDocument();

    // One of them goes away; the other is still mounted and still wants the banner.
    rerender(
      <AppBannerProvider>
        <AppBanner />
        <Publisher banner={same} />
      </AppBannerProvider>,
    );

    expect(screen.getByText('Ten sam komunikat')).toBeInTheDocument();
  });

  /**
   * Regression: dismissal is tracked per closeKey. A single shared "last dismissed"
   * key meant dismissing a page-level banner replaced the announcement's key, so when
   * the page banner cleared the announcement came back even though it was dismissed.
   */
  it('dismissing one banner does not un-dismiss another', () => {
    const ann: AppBannerState = { message: 'PL announcement', dismissible: true, dismissKey: 'ann' };
    const err: AppBannerState = { message: 'Boom', dismissible: true };
    const Duo = ({ b }: { b: AppBannerState | null }) => (
      <AppBannerProvider>
        <AppBanner />
        <Publisher banner={ann} />
        <Publisher banner={b} />
      </AppBannerProvider>
    );

    const { rerender } = render(<Duo b={null} />);
    // Announcement is showing — dismiss it.
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    // A page-level error is published; it wins as the most recent entry. Dismiss it too.
    rerender(<Duo b={err} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    // Error clears → announcement is the active entry again, and must stay dismissed.
    rerender(<Duo b={null} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
