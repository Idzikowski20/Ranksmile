import React from 'react';
import Link from 'next/link';
import type { AiSearchSection } from '../../lib/seoOverview/types';
import { workspaceHref } from '../../lib/activeWorkspace';
import {
  cardFlex, cardTitle, CountryPill, FONT, WidgetCtaStyle, WidgetSkeletonBar,
} from './widgetStyles';

type Props = {
  data: AiSearchSection;
  slug: string;
  workspaceId: number | null;
  loading?: boolean;
};

const AiSearchWidget = ({ data, slug, workspaceId, loading }: Props) => {
  const overviewHref = workspaceHref(workspaceId, `/sites/${slug}/ai-visibility/overview`);

  return (
    <section style={cardFlex} aria-label="AI Search">
      <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={cardTitle}>AI Search</h2>
        <CountryPill />
      </div>

      <div style={{ padding: '16px 24px 24px', flex: 1 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <WidgetSkeletonBar key={i} />
            ))}
          </div>
        ) : data.pending ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 180, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 14, color: '#52525C', fontFamily: FONT }}>No AI Visibility scan yet.</p>
            <Link href={overviewHref} style={WidgetCtaStyle}>
              Set up AI Visibility
            </Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              {[
                { label: 'AI Visibility', value: data.visibility },
                { label: 'Mentions', value: data.mentions },
                { label: 'Cited pages', value: data.citedPages },
              ].map((m) => (
                <div key={m.label}>
                  <div style={{ fontSize: 13, color: '#9F9FA9', fontFamily: FONT, marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: '#18181B', fontFamily: FONT, fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #F4F4F5', paddingTop: 16 }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8,
                fontSize: 12, fontWeight: 600, color: '#9F9FA9', fontFamily: FONT, textTransform: 'uppercase',
                letterSpacing: '0.04em', marginBottom: 8,
              }}
              >
                <span>Source</span>
                <span style={{ textAlign: 'right' }}>Mentions</span>
                <span style={{ textAlign: 'right' }}>Cited pages</span>
              </div>
              {data.models.map((m) => (
                <div
                  key={m.model}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8, alignItems: 'center',
                    padding: '10px 0', borderBottom: '1px solid #F4F4F5', fontSize: 14, fontFamily: FONT,
                  }}
                >
                  <span style={{ color: '#18181B', fontWeight: 500 }}>{m.label}</span>
                  <span style={{ textAlign: 'right', color: '#3F3F47', fontVariantNumeric: 'tabular-nums' }}>{m.mentions}</span>
                  <span style={{ textAlign: 'right', color: '#3F3F47', fontVariantNumeric: 'tabular-nums' }}>{m.citedPages}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default AiSearchWidget;
