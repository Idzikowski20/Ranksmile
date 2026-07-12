/**
 * Shared layout for domain sub-pages — Sentry Issues/Traces page chrome.
 */
import React from 'react';
import { SentryPage, SentryPageHeader } from '../sentry-pages';

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
};

const DomainSubLayout = ({
  children,
  actions,
  contentMaxWidth = 1200,
  heading,
  subtitle,
  meta,
  filters,
}: DomainSubLayoutProps) => (
  <SentryPage maxWidth={contentMaxWidth}>
    {heading && (
      <SentryPageHeader
        title={heading}
        subtitle={subtitle}
        actions={actions}
        meta={meta}
        borderless={!filters}
      />
    )}
    {!heading && actions && (
      <div className="sentry-page-filters-trailing" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {actions}
      </div>
    )}
    {filters}
    <div className="sentry-page-content">{children}</div>
  </SentryPage>
);

export default DomainSubLayout;
