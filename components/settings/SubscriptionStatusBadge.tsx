import React from 'react';
import { Badge, type BadgeAppearance } from '../koala/core/badge/badge';
import { Icon } from '../koala/icons/Icon';
import type { SubscriptionDetails } from '../../lib/subscriptionDetails';

export type SubscriptionBadgeTone = 'success' | 'neutral' | 'warning';

export type SubscriptionBadgeInfo = {
  label: string;
  tone: SubscriptionBadgeTone;
  icon: 'CheckCircle' | 'XCircle' | 'Warning';
};

const TONE_APPEARANCE: Record<SubscriptionBadgeTone, BadgeAppearance> = {
  success: 'success',
  neutral: 'muted',
  warning: 'warning',
};

/** Map org subscription state → Figma WidgetLicense-style status (Acquired / Not acquired / Out of date). */
export function resolveSubscriptionBadge(sub: SubscriptionDetails | null | undefined): SubscriptionBadgeInfo {
  if (!sub) {
    return { label: 'Not acquired', tone: 'neutral', icon: 'XCircle' };
  }
  if (sub.paymentFailedLocked || sub.subscriptionStatus === 'past_due' || sub.subscriptionStatus === 'unpaid') {
    return { label: 'Payment failed', tone: 'warning', icon: 'Warning' };
  }
  if (sub.cancelAtPeriodEnd) {
    return { label: 'Cancels soon', tone: 'warning', icon: 'Warning' };
  }
  if (sub.isTrialing || sub.subscriptionStatus === 'trialing') {
    return { label: 'Trial', tone: 'warning', icon: 'Warning' };
  }
  if (
    sub.subscriptionStatus === 'incomplete'
    || sub.subscriptionStatus === 'incomplete_expired'
    || sub.subscriptionStatus === 'canceled'
  ) {
    return { label: 'Not acquired', tone: 'neutral', icon: 'XCircle' };
  }
  if (sub.hasStripeSubscription && sub.subscriptionStatus === 'active') {
    return { label: 'Paid', tone: 'success', icon: 'CheckCircle' };
  }
  if (sub.hasStripeSubscription) {
    return { label: 'Active', tone: 'success', icon: 'CheckCircle' };
  }
  return { label: 'Not acquired', tone: 'neutral', icon: 'XCircle' };
}

export function SubscriptionStatusBadge({
  info,
}: {
  info: SubscriptionBadgeInfo;
}) {
  const appearance = TONE_APPEARANCE[info.tone];
  return (
    <Badge
      appearance={appearance}
      size="md"
      icon={(
        <Icon
          name={info.icon}
          size={14}
          weight={info.icon === 'CheckCircle' ? 'fill' : 'bold'}
        />
      )}
      style={{ fontSize: 14, fontWeight: 500, height: 'auto', padding: '2px 6px' }}
    >
      {info.label}
    </Badge>
  );
}

/** Figma WidgetLicense row: label + status, with hover pill. */
export function SubscriptionStatusRow({
  label,
  info,
}: {
  label: string;
  info: SubscriptionBadgeInfo;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '4px 8px',
        borderRadius: 12,
        background: hover ? 'var(--koala-bg-secondary)' : 'transparent',
        fontFamily: 'var(--font-family-primary)',
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--koala-text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <SubscriptionStatusBadge info={info} />
    </div>
  );
}
