import React from 'react';
import { SentryPanel, SentryPanelBody } from '../sentry-pages';

interface UsageRow {
  label: string;
  value: string;
}

interface UsageBlock {
  name: string;
  limit: string;
  rows: UsageRow[];
}

const CARD_EDITOR: UsageBlock[] = [
  {
    name: 'Content Editor',
    limit: 'Monthly limit: 30',
    rows: [
      { label: 'Available from subscription', value: '30' },
      { label: 'Used', value: '0' },
    ],
  },
  {
    name: 'Auto-optimize',
    limit: 'Monthly limit',
    rows: [{ label: 'Available', value: '100' }],
  },
];

const CARD_CONTENT_AUDIT: UsageBlock[] = [
  {
    name: 'Content Audit',
    limit: 'Pages limit: 200',
    rows: [
      { label: 'Available', value: '188' },
      { label: 'Used', value: '12' },
    ],
  },
];

const CARD_AUDIT: UsageBlock[] = [
  {
    name: 'Audit',
    limit: 'Monthly limit: 100',
    rows: [
      { label: 'Available', value: '100' },
      { label: 'Used', value: '0' },
    ],
  },
];

const font = 'var(--font-family-primary)';
const numeric: React.CSSProperties = { fontVariantNumeric: 'tabular-nums slashed-zero' };

const Row = ({ label, value }: UsageRow) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
    <span style={{ fontFamily: font, fontSize: 13, fontWeight: 500, color: '#3F3F47' }}>{label}</span>
    <span style={{ ...numeric, fontFamily: font, fontSize: 13, fontWeight: 600, color: '#18181B' }}>{value}</span>
  </div>
);

const Block = ({ block }: { block: UsageBlock }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontFamily: font, fontSize: 16, fontWeight: 500, color: '#09090B' }}>{block.name}</span>
      <span style={{ ...numeric, fontFamily: font, fontSize: 13, color: '#52525C' }}>{block.limit}</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {block.rows.map((r) => (
        <Row key={r.label} label={r.label} value={r.value} />
      ))}
    </div>
  </div>
);

const UsageCard = ({ blocks }: { blocks: UsageBlock[] }) => (
  <SentryPanel>
    <SentryPanelBody>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {blocks.map((b) => (
          <Block key={b.name} block={b} />
        ))}
      </div>
    </SentryPanelBody>
  </SentryPanel>
);

const UsageSettings = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: font }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: '#18181B' }}>Plan</span>
      <span style={{ fontSize: 14, color: '#52525C' }}>Renews in 7 days</span>
    </div>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gridTemplateRows: 'repeat(2, auto)',
        gap: 16,
      }}
    >
      <div style={{ gridColumn: 1, gridRow: '1 / 3' }}>
        <UsageCard blocks={CARD_EDITOR} />
      </div>
      <div style={{ gridColumn: 2, gridRow: 1 }}>
        <UsageCard blocks={CARD_CONTENT_AUDIT} />
      </div>
      <div style={{ gridColumn: 2, gridRow: 2 }}>
        <UsageCard blocks={CARD_AUDIT} />
      </div>
    </div>
  </div>
);

export default UsageSettings;
