import React from 'react';
import type { BacklinksSection } from '../../lib/seoOverview/types';
import { cardFlex, FONT, WidgetHeader } from './widgetStyles';

type Props = {
  data: BacklinksSection;
  loading?: boolean;
};

const BacklinksWidget = ({ data, loading }: Props) => (
  <section style={cardFlex} aria-label="Backlinks">
    <WidgetHeader
      title="Backlinks"
      meta={<div style={{ fontSize: 12, color: '#9F9FA9', fontFamily: FONT }}>Root Domain</div>}
    />
    <div style={{ padding: '12px 24px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
      {loading ? (
        <div style={{ height: 220, borderRadius: 8, background: '#E8E8ED' }} />
      ) : !data.available ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 12, minHeight: 200, textAlign: 'center', padding: 16,
        }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: '#3F3F47', fontFamily: FONT }}>Backlink Audit</div>
          <p style={{ margin: 0, fontSize: 13, color: '#52525C', fontFamily: FONT, lineHeight: '20px', maxWidth: 280 }}>
            Backlink analytics require a separate DataForSEO subscription. This module is not enabled.
          </p>
          <span style={{
            display: 'inline-flex', padding: '8px 14px', borderRadius: 8, background: '#F4F4F5',
            color: '#9F9FA9', fontSize: 13, fontWeight: 600, fontFamily: FONT,
          }}
          >
            Set up
          </span>
        </div>
      ) : null}
    </div>
  </section>
);

export default BacklinksWidget;
