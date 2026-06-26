import React from 'react';

type Status = 'published' | 'draft' | 'updated' | 'created';

const STATUS: Record<Status, { bg: string; color: string }> = {
  published: { bg: '#F0FDF4', color: '#15803D' },
  draft: { bg: '#F9FAFB', color: '#6B7280' },
  updated: { bg: '#EFF6FF', color: '#1D4ED8' },
  created: { bg: '#FAF5FF', color: '#6D28D9' },
};

const Badge = ({ variant = 'status', status, children }: {
  variant?: 'status' | 'suggestion' | 'filter'; status?: Status; children: React.ReactNode;
}) => {
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', borderRadius: 8, padding: '1px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-family-primary)' };
  let skin: React.CSSProperties = {};
  if (variant === 'status' && status) skin = { background: STATUS[status].bg, color: STATUS[status].color };
  if (variant === 'suggestion') skin = { background: 'rgba(120,58,251,0.08)', color: '#783AFB' };
  if (variant === 'filter') skin = { background: '#F4F4F5', color: '#3F3F47' };
  return <span style={{ ...base, ...skin }}>{children}</span>;
};

export default Badge;
