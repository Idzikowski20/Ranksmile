import React from 'react';
import Link from 'next/link';
import { Icon } from '../icons/Icon';
import TopbarSearch from '../../common/TopbarSearch';
import TopbarInbox from '../../common/TopbarInbox';
import { ThemeCycleButton } from '../theme/ThemeSwitcher';
import SidebarUserFooter from './SidebarUserFooter';

type Props = {
  breadcrumb?: React.ReactNode;
  onMobileMenuClick?: () => void;
};

/**
 * Product Header — Figma `6959:74257`
 * Search left + help / inbox / settings / avatar right.
 */
export default function KoalaHeader({ breadcrumb, onMobileMenuClick }: Props) {
  return (
    <header className="koala-header">
      <div className="koala-header__left">
        {onMobileMenuClick ? (
          <button
            type="button"
            className="koala-header__icon-btn koala-header__menu-btn"
            aria-label="Open navigation menu"
            onClick={onMobileMenuClick}
          >
            <Icon name="List" size={20} weight="bold" />
          </button>
        ) : null}

        {breadcrumb ? (
          <div className="koala-header__breadcrumb">{breadcrumb}</div>
        ) : (
          <div className="koala-header__search">
            <TopbarSearch variant="header" />
          </div>
        )}
      </div>

      <div className="koala-header__right">
        <a
          href="https://ranksmile.pl"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Help"
          className="koala-header__icon-btn"
        >
          <Icon name="Question" size={20} weight="bold" />
        </a>
        <TopbarInbox />
        <ThemeCycleButton className="koala-header__icon-btn" />
        <Link href="/settings/general" passHref>
          <a className="koala-header__icon-btn" aria-label="Settings">
            <Icon name="Gear" size={20} weight="bold" />
          </a>
        </Link>
        <SidebarUserFooter variant="header" />
      </div>
    </header>
  );
}
