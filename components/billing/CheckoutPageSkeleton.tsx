import React from 'react';

const Bone = ({
  width,
  height,
  radius = 8,
  style,
}: {
  width: number | string;
  height: number | string;
  radius?: number;
  style?: React.CSSProperties;
}) => (
  <div
    aria-hidden="true"
    className="koala-skeleton-block"
    style={{ width, height, borderRadius: radius, ...style }}
  />
);

/** Skeleton matching Koala checkout layout (Figma 8420:261739). */
export function CheckoutPageSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="cko-skel"
      style={{ width: '100%', maxWidth: 1120, margin: '0 auto' }}
    >
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

      <style>{`
        .cko-skel-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 1px minmax(280px, 384px);
          gap: 0 40px;
          align-items: start;
        }
        .cko-skel-rail { width: 1px; background: #e5e5e5; align-self: stretch; min-height: 480px; }
        .cko-skel-left { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
        .cko-skel-right { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
        .cko-skel-methods { display: flex; gap: 16px; }
        .cko-skel-methods > * { flex: 1; }
        .cko-skel-billing { display: flex; gap: 16px; }
        .cko-skel-billing > * { flex: 1; }
        .cko-skel-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 960px) {
          .cko-skel-grid { grid-template-columns: 1fr; gap: 32px; }
          .cko-skel-rail { display: none; }
          .cko-skel-methods { flex-direction: column; }
        }
      `}</style>

      <div className="cko-skel-grid">
        {/* Left — form */}
        <div className="cko-skel-left">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Bone width={260} height={34} radius={10} />
            <Bone width="72%" height={18} radius={6} />
          </div>

          <div>
            <Bone width={56} height={18} radius={6} style={{ marginBottom: 8 }} />
            <Bone width="100%" height={40} radius={12} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Bone width="30%" height={1} radius={0} />
            <Bone width={140} height={14} radius={6} />
            <Bone width="30%" height={1} radius={0} />
          </div>

          <div>
            <Bone width={140} height={18} radius={6} style={{ marginBottom: 8 }} />
            <div className="cko-skel-methods">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    border: '1px solid #e5e5e5',
                    borderRadius: 16,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    minHeight: 88,
                  }}
                >
                  <Bone width={36} height={24} radius={4} />
                  <Bone width={64} height={16} radius={6} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <Bone width={72} height={18} radius={6} style={{ marginBottom: 8 }} />
            <div className="cko-skel-billing">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  style={{
                    border: '1px solid #e5e5e5',
                    borderRadius: 16,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    minHeight: 72,
                  }}
                >
                  <Bone width={80} height={16} radius={6} />
                  <Bone width={96} height={14} radius={6} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <Bone width={110} height={16} radius={6} style={{ marginBottom: 8 }} />
              <Bone width="100%" height={44} radius={12} />
            </div>
            <div className="cko-skel-row2">
              <div>
                <Bone width={90} height={16} radius={6} style={{ marginBottom: 8 }} />
                <Bone width="100%" height={40} radius={12} />
              </div>
              <div>
                <Bone width={120} height={16} radius={6} style={{ marginBottom: 8 }} />
                <Bone width="100%" height={40} radius={12} />
              </div>
            </div>
            <div>
              <Bone width={140} height={16} radius={6} style={{ marginBottom: 8 }} />
              <Bone width="100%" height={40} radius={12} />
            </div>
            <div>
              <Bone width={110} height={16} radius={6} style={{ marginBottom: 8 }} />
              <Bone width="100%" height={40} radius={12} />
            </div>
            <div className="cko-skel-row2">
              <div>
                <Bone width={48} height={16} radius={6} style={{ marginBottom: 8 }} />
                <Bone width="100%" height={40} radius={12} />
              </div>
              <div>
                <Bone width={40} height={16} radius={6} style={{ marginBottom: 8 }} />
                <Bone width="100%" height={40} radius={12} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            <Bone width="100%" height={44} radius={14} />
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Bone width={180} height={14} radius={6} />
            </div>
          </div>
        </div>

        <div className="cko-skel-rail" aria-hidden />

        {/* Right — summary */}
        <aside className="cko-skel-right">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Bone width={120} height={28} radius={8} />
            <Bone width="90%" height={16} radius={6} />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Bone width={56} height={56} radius={12} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <Bone width="45%" height={18} radius={6} />
                <Bone width={64} height={18} radius={6} />
              </div>
              <Bone width="70%" height={14} radius={6} />
              <Bone width={88} height={32} radius={10} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bone width={14} height={14} radius={4} />
                <Bone width={`${78 - i * 8}%`} height={12} radius={6} />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Bone width="100%" height={40} radius={12} style={{ flex: 1 }} />
            <Bone width={108} height={40} radius={12} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Bone width={72} height={14} radius={6} />
              <Bone width={64} height={14} radius={6} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Bone width={88} height={14} radius={6} />
              <Bone width={56} height={14} radius={6} />
            </div>
            <Bone width="100%" height={1} radius={0} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Bone width={56} height={18} radius={6} />
              <Bone width={72} height={18} radius={6} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
            <Bone width={64} height={64} radius={9999} />
            <Bone width={120} height={16} radius={6} />
            <Bone width={140} height={14} radius={6} />
            <Bone width="100%" height={14} radius={6} />
            <Bone width="92%" height={14} radius={6} />
            <Bone width="80%" height={14} radius={6} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bone width={28} height={28} radius={9999} />
              <Bone width={88} height={16} radius={6} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
