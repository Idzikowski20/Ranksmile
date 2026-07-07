import React from 'react';

type SentryPageProps = {
  children: React.ReactNode;
  maxWidth?: number | string;
  className?: string;
  unified?: boolean;
};

/** Main scrollable page container (Sentry Issues/Traces background). */
export function SentryPage({ children, maxWidth = 1200, className = '', unified }: SentryPageProps) {
  const maxW = typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth;
  return (
    <div className={`sentry-page ${unified ? 'sentry-page--unified' : ''} ${className}`}>
      <div
        className="sentry-page-inner styled-scrollbar"
        style={{ maxWidth: maxW, width: '100%' }}
      >
        {children}
      </div>
    </div>
  );
}

type SentryPageHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  borderless?: boolean;
};

export function SentryPageHeader({ title, subtitle, icon, actions, meta, borderless }: SentryPageHeaderProps) {
  return (
    <header className={`sentry-page-header ${borderless ? 'sentry-page-header--borderless' : ''}`}>
      <div className="sentry-page-header-main">
        {icon && <span className="sentry-page-header-icon">{icon}</span>}
        <div className="sentry-page-header-titles">
          <h1 className="sentry-page-header-title">{title}</h1>
          {subtitle && <p className="sentry-page-header-subtitle">{subtitle}</p>}
        </div>
        {meta && <div className="sentry-page-header-meta">{meta}</div>}
      </div>
      {actions && <div className="sentry-page-header-actions">{actions}</div>}
    </header>
  );
}

type SentryPageFiltersProps = {
  children: React.ReactNode;
  trailing?: React.ReactNode;
};

export function SentryPageFilters({ children, trailing }: SentryPageFiltersProps) {
  return (
    <div className="sentry-page-filters">
      <div className="sentry-page-filters-main">{children}</div>
      {trailing && <div className="sentry-page-filters-trailing">{trailing}</div>}
    </div>
  );
}

type SentryPanelProps = {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
};

export function SentryPanel({ children, className = '', noPadding }: SentryPanelProps) {
  return (
    <section className={`sentry-panel ${noPadding ? 'sentry-panel--flush' : ''} ${className}`}>
      {children}
    </section>
  );
}

type SentryPanelHeaderProps = {
  title: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
};

export function SentryPanelHeader({ title, actions, tabs }: SentryPanelHeaderProps) {
  return (
    <div className="sentry-panel-header">
      <div className="sentry-panel-header-top">
        <h2 className="sentry-panel-title">{title}</h2>
        {actions && <div className="sentry-panel-actions">{actions}</div>}
      </div>
      {tabs && <div className="sentry-panel-tabs">{tabs}</div>}
    </div>
  );
}

export function SentryPanelBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`sentry-panel-body ${className}`}>{children}</div>;
}

type SentryDetailLayoutProps = {
  main: React.ReactNode;
  aside: React.ReactNode;
};

export function SentryDetailLayout({ main, aside }: SentryDetailLayoutProps) {
  return (
    <div className="sentry-detail-layout">
      <div className="sentry-detail-main">{main}</div>
      <aside className="sentry-detail-aside">{aside}</aside>
    </div>
  );
}

type SentrySettingsSectionProps = {
  title: string;
  children: React.ReactNode;
};

export function SentrySettingsSection({ title, children }: SentrySettingsSectionProps) {
  return (
    <section className="sentry-settings-section">
      <div className="sentry-settings-section-header">{title}</div>
      <div className="sentry-settings-section-body">{children}</div>
    </section>
  );
}

type SentrySettingsRowProps = {
  label: React.ReactNode;
  description?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
};

export function SentrySettingsRow({ label, description, required, children }: SentrySettingsRowProps) {
  const hasControl = children != null && children !== false;
  return (
    <div className="sentry-settings-row">
      <div className="sentry-settings-row-label">
        <div className="sentry-settings-row-label-text">
          {label}
          {required && <span className="sentry-settings-required" aria-hidden="true">*</span>}
        </div>
        {description && <p className="sentry-settings-row-desc">{description}</p>}
      </div>
      {hasControl && <div className="sentry-settings-row-control">{children}</div>}
    </div>
  );
}

export function SentryEmptyState({ title, description, actions }: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="sentry-empty-state">
      <h3 className="sentry-empty-state-title">{title}</h3>
      {description && <p className="sentry-empty-state-desc">{description}</p>}
      {actions && <div className="sentry-empty-state-actions">{actions}</div>}
    </div>
  );
}

export {
  SentryTable,
  SentryTableHead,
  SentryTableBody,
  SentryTableRow,
  SentryTableCell,
  SentryTableHeaderCell,
} from './table';
