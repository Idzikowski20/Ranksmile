import React from 'react';

const Bone = ({
  width,
  height,
  radius = 6,
  style,
}: {
  width: number | string;
  height: number | string;
  radius?: number;
  style?: React.CSSProperties;
}) => (
  <div
    aria-hidden="true"
    className="sentry-skeleton-block"
    style={{ width, height, borderRadius: radius, ...style }}
  />
);

const CardShell = ({
  children,
  padding = 20,
}: {
  children: React.ReactNode;
  padding?: number;
}) => (
  <div
    style={{
      border: '1px solid #dbded4',
      borderRadius: 12,
      padding,
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}
  >
    {children}
  </div>
);

/** Full-page checkout placeholder while Stripe PaymentIntent / SetupIntent loads. */
export function CheckoutPageSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        Loading secure payment form
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
        <Bone width={280} height={28} radius={8} />
      </div>

      <div className="checkout-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Bone width={96} height={14} />
              <Bone width={100} height={14} />
            </div>
            <CardShell padding={16}>
              <Bone width={88} height={16} />
              <Bone width="55%" height={14} />
            </CardShell>
          </section>

          <CardShell>
            <Bone width={110} height={14} />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bone width={18} height={18} radius={4} />
                <Bone width={`${68 - i * 6}%`} height={14} />
              </div>
            ))}
          </CardShell>

          <CardShell>
            <Bone width={130} height={14} />
            <Bone width="100%" height={44} radius={8} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Bone width="100%" height={44} radius={8} />
              <Bone width="100%" height={44} radius={8} />
            </div>
            <Bone width="100%" height={44} radius={8} />
          </CardShell>

          <CardShell>
            <Bone width={180} height={14} />
            <Bone width="70%" height={12} />
            <Bone width="100%" height={40} radius={8} />
            <Bone width="100%" height={40} radius={8} />
            <Bone width="100%" height={40} radius={8} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 124px', gap: 12 }}>
              <Bone width="100%" height={40} radius={8} />
              <Bone width="100%" height={40} radius={8} />
            </div>
          </CardShell>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <CardShell>
            <Bone width={160} height={14} />
            <Bone width="90%" height={40} />
            <Bone width="75%" height={14} />
            <Bone width="80%" height={14} />
            <Bone width="100%" height={44} radius={8} style={{ marginTop: 8 }} />
            <Bone width="100%" height={44} radius={8} />
          </CardShell>
          <Bone width="85%" height={12} style={{ alignSelf: 'center' }} />
        </aside>
      </div>
    </div>
  );
}
