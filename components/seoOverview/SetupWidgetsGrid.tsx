import React from 'react';
import Link from 'next/link';
import { workspaceHref } from '../../lib/activeWorkspace';
import { card, FONT } from './widgetStyles';

type SetupItem = {
  title: string;
  description: string;
  href: string;
  available: boolean;
};

type Props = {
  slug: string;
  workspaceId: number | null;
};

const SetupCard = ({ item }: { item: SetupItem }) => (
  <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 140 }}>
    <div style={{ fontSize: 14, fontWeight: 600, color: '#3F3F47', fontFamily: FONT }}>{item.title}</div>
    <p style={{ margin: 0, fontSize: 13, color: '#52525C', fontFamily: FONT, lineHeight: '20px', flex: 1 }}>{item.description}</p>
    {item.available ? (
      <Link href={item.href} style={{
        display: 'inline-flex', alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 8,
        background: '#2F2F34', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', fontFamily: FONT,
      }}
      >
        Set up
      </Link>
    ) : (
      <span style={{
        display: 'inline-flex', alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 8,
        background: '#F4F4F5', color: '#9F9FA9', fontSize: 13, fontWeight: 600, fontFamily: FONT,
      }}
      >
        Coming soon
      </span>
    )}
  </div>
);

const SetupWidgetsGrid = ({ slug, workspaceId }: Props) => {
  const items: SetupItem[] = [
    {
      title: 'On Page SEO Checker',
      description: 'Collect ideas on strategy, content, backlinks and more.',
      href: workspaceHref(workspaceId, `/sites/${slug}/audit-tool`),
      available: true,
    },
    {
      title: 'Backlink Audit',
      description: 'Detoxify your backlink portfolio and strengthen your website rankings.',
      href: '#',
      available: false,
    },
    {
      title: 'Organic Traffic Insights',
      description: 'Uncover not-provided keywords combining GA, GSC and Semrush data.',
      href: workspaceHref(workspaceId, `/sites/${slug}/performance`),
      available: true,
    },
    {
      title: 'Link Building Tool',
      description: 'Uncover backlink opportunities in your niche.',
      href: '#',
      available: false,
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, height: '100%' }} aria-label="Setup widgets">
      {items.map((item) => (
        <SetupCard key={item.title} item={item} />
      ))}
    </div>
  );
};

export default SetupWidgetsGrid;
