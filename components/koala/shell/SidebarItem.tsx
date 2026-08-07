import React from 'react';
import Link from 'next/link';
import { Icon } from '../icons/Icon';

export type SidebarItemProps = {
  href?: string;
  label: string;
  icon?: string;
  active?: boolean;
  badge?: React.ReactNode;
  onClick?: () => void;
  level?: 0 | 1;
  trailing?: React.ReactNode;
};

/**
 * Sidebar Tab Item — Figma Navigation `4866:462989` / Product Sidebar `4903:6905`.
 *
 * Next.js 12 Link: must wrap a real `<a>` (not Fragment). Fragment children previously
 * dropped flex styles → icon stacked above label.
 */
export function SidebarItem({
  href,
  label,
  icon,
  active = false,
  badge,
  onClick,
  level = 0,
  trailing,
}: SidebarItemProps) {
  const className = [
    'koala-sidebar-item',
    active ? 'koala-sidebar-item--active' : '',
    level === 1 ? 'koala-sidebar-item--nested' : '',
  ].filter(Boolean).join(' ');

  // Stable hook for the page tour (`[data-tour="nav-site-audit"]`) — derived from the
  // label so every item is targetable without threading a prop through each call site.
  const tourId = `nav-${label.toLowerCase().replace(/\s+/g, '-')}`;

  const body = (
    <>
      {icon ? (
        <span className="koala-sidebar-item__icon" aria-hidden="true">
          <Icon name={icon} size={16} weight="bold" />
        </span>
      ) : null}
      <span className="koala-sidebar-item__label">{label}</span>
      {badge != null ? <span className="koala-sidebar-item__badge">{badge}</span> : null}
      {trailing}
    </>
  );

  if (href) {
    return (
      <Link href={href} passHref>
        <a
          className={className}
          aria-current={active ? 'page' : undefined}
          onClick={onClick}
          data-tour={tourId}
        >
          {body}
        </a>
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick} data-tour={tourId}>
      {body}
    </button>
  );
}

export function SidebarSectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="koala-sidebar-section-title">{children}</div>;
}

export function SidebarBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="koala-sidebar-block">
      <SidebarSectionTitle>{title}</SidebarSectionTitle>
      <div className="koala-sidebar-block__items">{children}</div>
    </div>
  );
}
