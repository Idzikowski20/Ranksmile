import React from 'react';
import { render, screen } from '@testing-library/react';
import toast from 'react-hot-toast';
import { showCancellationApprovedToast } from '../../components/settings/SubscriptionSettings';

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    custom: jest.fn(),
    dismiss: jest.fn(),
  },
}));

describe('Subscription cancellation toast', () => {
  it('uses the approved request title and non-renewal copy', () => {
    showCancellationApprovedToast();

    expect(toast.custom).toHaveBeenCalledTimes(1);
    const renderToast = (toast.custom as jest.Mock).mock.calls[0][0];
    render(<>{renderToast({ id: 'toast-1', visible: true })}</>);

    expect(screen.getByText('Your request has been approved')).toBeInTheDocument();
    expect(screen.getByText("Your plan won't auto-renew and charges will not be incurred.")).toBeInTheDocument();
  });
});
