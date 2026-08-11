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
});
