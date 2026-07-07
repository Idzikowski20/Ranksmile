import React, { forwardRef } from 'react';

type MenuListItemPriority = 'default' | 'primary' | 'danger';

export type MenuListItemProps = React.HTMLAttributes<HTMLButtonElement> & {
  label: React.ReactNode;
  details?: React.ReactNode;
  leadingItems?: React.ReactNode;
  trailingItems?: React.ReactNode;
  priority?: MenuListItemPriority;
  disabled?: boolean;
  as?: 'button' | 'a';
  href?: string;
};

const MenuListItem = forwardRef<HTMLButtonElement, MenuListItemProps>(
  (
    {
      label,
      details,
      leadingItems,
      trailingItems,
      priority = 'default',
      disabled = false,
      as = 'button',
      href,
      className = '',
      ...rest
    },
    ref
  ) => {
    const cls = `sentry-menu-list-item sentry-menu-list-item--${priority} ${className}`;
    const inner = (
      <>
        {leadingItems && <span className="sentry-menu-list-item-leading">{leadingItems}</span>}
        <span className="sentry-menu-list-item-content">
          <span className="sentry-menu-list-item-label">{label}</span>
          {details && <span className="sentry-menu-list-item-details">{details}</span>}
        </span>
        {trailingItems && <span className="sentry-menu-list-item-trailing">{trailingItems}</span>}
      </>
    );
    if (as === 'a' && href) {
      return (
        <a
          href={href}
          className={cls}
          aria-disabled={disabled || undefined}
          {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {inner}
        </a>
      );
    }
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={cls}
        {...rest}
      >
        {inner}
      </button>
    );
  }
);
MenuListItem.displayName = 'MenuListItem';
export default MenuListItem;
