/**
 * Shared layout for domain sub-pages — Koala Dashboard page chrome.
 */
import React from 'react';
import { KoalaPage, KoalaPageHeader } from '../koala/layout';

type DomainSubLayoutProps = {
  domain: string;
  slug: string;
  section: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  contentMaxWidth?: number | string;
  heading?: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  filters?: React.ReactNode;
  /** No page scroll — table/content area scrolls internally. */
  fillHeight?: boolean;
};

const DomainSubLayout = ({
  children,
  actions,
  contentMaxWidth = 1200,
  heading,
  subtitle,
  meta,
  filters,
  fillHeight,
}: DomainSubLayoutProps) => (
  <KoalaPage maxWidth={contentMaxWidth} fillHeight={fillHeight}>
    {heading && (
      <KoalaPageHeader
        title={heading}
        subtitle={subtitle}
        actions={actions}
        meta={meta}
        borderless={!filters}
      />
    )}
    {!heading && actions && (
      <div className="koala-page-filters-trailing" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {actions}
      </div>
    )}
    {filters}
    <div className="koala-page-content">{children}</div>
  </KoalaPage>
);

export default DomainSubLayout;
