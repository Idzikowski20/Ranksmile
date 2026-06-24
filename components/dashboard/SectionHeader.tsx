import React from 'react';

/** Section label row: muted icon + 14px semibold title (matches Surfer dashboard). */
const SectionHeader = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#52525C' }}>
    {icon}
    <span style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600, fontFamily: 'var(--font-family-primary)' }}>{label}</span>
  </div>
);

export default SectionHeader;
