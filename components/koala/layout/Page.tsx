import React from 'react';

type KoalaPageProps = {
  children: React.ReactNode;
  maxWidth?: number | string;
  className?: string;
  unified?: boolean;
  fillHeight?: boolean;
};

/** Main scrollable page — Koala Dashboard template chrome. */
export function KoalaPage({ children, maxWidth = 1200, className = '', unified, fillHeight }: KoalaPageProps) {
  const maxW = typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth;
  return (
    <div className={`koala-page ${unified ? 'koala-page--unified' : ''} ${fillHeight ? 'koala-page--fill' : ''} ${className}`.trim()}>
      <div className="koala-page-inner styled-scrollbar" style={{ maxWidth: maxW, width: '100%' }}>
        {children}
      </div>
    </div>
  );
}

type KoalaPageHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  borderless?: boolean;
};

export function KoalaPageHeader({ title, subtitle, icon, actions, meta, borderless }: KoalaPageHeaderProps) {
  return (
    <header className={`koala-page-header ${borderless ? 'koala-page-header--borderless' : ''}`}>
      {meta ? <div className="koala-page-header-meta">{meta}</div> : null}
      <div className="koala-page-header-row">
        <div className="koala-page-header-main">
          {icon ? <span className="koala-page-header-icon">{icon}</span> : null}
          <div className="koala-page-header-titles">
            <h1 className="koala-page-header-title">{title}</h1>
            {subtitle ? <div className="koala-page-header-subtitle">{subtitle}</div> : null}
          </div>
        </div>
        {actions ? <div className="koala-page-header-actions">{actions}</div> : null}
      </div>
    </header>
  );
}

type KoalaPageFiltersProps = {
  children: React.ReactNode;
  trailing?: React.ReactNode;
};

export function KoalaPageFilters({ children, trailing }: KoalaPageFiltersProps) {
  return (
    <div className="koala-page-filters">
      <div className="koala-page-filters-main">{children}</div>
      {trailing ? <div className="koala-page-filters-trailing">{trailing}</div> : null}
    </div>
  );
}

type KoalaPanelProps = {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
};

export function KoalaPanel({ children, className = '', noPadding }: KoalaPanelProps) {
  return (
    <section className={`koala-panel ${noPadding ? 'koala-panel--flush' : ''} ${className}`}>
      {children}
    </section>
  );
}

type KoalaPanelHeaderProps = {
  title: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
};

export function KoalaPanelHeader({ title, actions, tabs }: KoalaPanelHeaderProps) {
  return (
    <div className="koala-panel-header">
      <div className="koala-panel-header-top">
        <h2 className="koala-panel-title">{title}</h2>
        {actions ? <div className="koala-panel-actions">{actions}</div> : null}
      </div>
      {tabs ? <div className="koala-panel-tabs">{tabs}</div> : null}
    </div>
  );
}

export function KoalaPanelBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`koala-panel-body ${className}`}>{children}</div>;
}

export function KoalaDetailLayout({ main, aside }: { main: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="koala-detail-layout">
      <div className="koala-detail-main">{main}</div>
      <aside className="koala-detail-aside">{aside}</aside>
    </div>
  );
}

export function KoalaSettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="koala-settings-section">
      <div className="koala-settings-section-header">{title}</div>
      <div className="koala-settings-section-body">{children}</div>
    </section>
  );
}

export function KoalaSettingsRow({
  label,
  description,
  required,
  children,
  layout = 'row',
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  /** `stack` = label above control (full width). Default `row` = settings two-column grid. */
  layout?: 'row' | 'stack';
}) {
  const hasControl = children != null && children !== false;
  return (
    <div className={`koala-settings-row${layout === 'stack' ? ' koala-settings-row--stack' : ''}`}>
      <div className="koala-settings-row-label">
        <div className="koala-settings-row-label-text">
          {label}
          {required ? <span className="koala-settings-required" aria-hidden="true">*</span> : null}
        </div>
        {description ? <p className="koala-settings-row-desc">{description}</p> : null}
      </div>
      {hasControl ? <div className="koala-settings-row-control">{children}</div> : null}
    </div>
  );
}

export function KoalaEmptyState({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="koala-empty-state">
      <h3 className="koala-empty-state-title">{title}</h3>
      {description ? <p className="koala-empty-state-desc">{description}</p> : null}
      {actions ? <div className="koala-empty-state-actions">{actions}</div> : null}
    </div>
  );
}

/** @deprecated Use Koala* names — migration aliases. */
export const SentryPage = KoalaPage;
export const SentryPageHeader = KoalaPageHeader;
export const SentryPageFilters = KoalaPageFilters;
export const SentryPanel = KoalaPanel;
export const SentryPanelHeader = KoalaPanelHeader;
export const SentryPanelBody = KoalaPanelBody;
export const SentryDetailLayout = KoalaDetailLayout;
export const SentrySettingsSection = KoalaSettingsSection;
export const SentrySettingsRow = KoalaSettingsRow;
export const SentryEmptyState = KoalaEmptyState;
