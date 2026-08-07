/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { authClient } from '../../../lib/auth/client';
import { useProfile } from '../../../services/profile';
import { useGscAccount } from '../../../services/gscAccount';
import { Avatar } from '../core/avatar';
import { Icon } from '../icons/Icon';

function UserMenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} passHref>
      <a className="koala-sidebar-user__link" role="menuitem" onClick={onClick}>
        {children}
      </a>
    </Link>
  );
}

type Props = {
  /** `header` = compact avatar in Product Header (menu opens downward). */
  variant?: 'sidebar' | 'header';
};

/**
 * Account menu — sidebar row or header avatar (Koala Product Header).
 */
export default function SidebarUserFooter({ variant = 'sidebar' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { data: profile } = useProfile();
  const { data: gscAccount } = useGscAccount();
  const session = authClient.useSession?.();

  const userPic = profile?.avatarUrl || gscAccount?.picture || '';
  const userName = profile?.name || session?.data?.user?.name || 'Account';
  const userEmail = session?.data?.user?.email || '';
  const userInitial = userName.charAt(0).toUpperCase();
  const handle = userEmail ? `@${userEmail.split('@')[0]}` : '';
  const isHeader = variant === 'header';

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const signOut = async () => {
    setOpen(false);
    await authClient.signOut();
    window.location.href = '/auth/sign-in';
  };

  return (
    <div
      ref={ref}
      className={`koala-sidebar-user${isHeader ? ' koala-sidebar-user--header' : ''}`}
    >
      <button
        type="button"
        className={`koala-sidebar-user__trigger${open ? ' koala-sidebar-user__trigger--open' : ''}${isHeader ? ' koala-sidebar-user__trigger--header' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={userName}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="koala-sidebar-user__avatar-wrap">
          <Avatar
            src={userPic || undefined}
            initials={userInitial}
            size={isHeader ? 28 : 32}
            badge={isHeader ? 'certificate' : 'flag'}
            flagCode="US"
          />
        </span>
        {!isHeader ? (
          <>
            <span className="koala-sidebar-user__meta">
              <span className="koala-sidebar-user__name">{userName}</span>
              {handle ? <span className="koala-sidebar-user__handle">{handle}</span> : null}
            </span>
            <Icon name="CaretUpDown" size={16} weight="bold" />
          </>
        ) : null}
      </button>

      {open ? (
        <div
          className={`koala-sidebar-user__menu${isHeader ? ' koala-sidebar-user__menu--header' : ''}`}
          role="menu"
        >
          {isHeader ? (
            <>
              <div className="koala-sidebar-user__menu-head">
                <Avatar src={userPic || undefined} initials={userInitial} size={32} />
                <span className="koala-sidebar-user__menu-head-meta">
                  <span className="koala-sidebar-user__name">{userName}</span>
                  {handle ? <span className="koala-sidebar-user__handle">{handle}</span> : null}
                </span>
              </div>
              <div className="koala-sidebar-user__divider" />
            </>
          ) : (
            <>
              <UserMenuLink href="/settings/profile" onClick={() => setOpen(false)}>
                <Icon name="User" size={16} weight="bold" />
                Profile
              </UserMenuLink>
              <UserMenuLink href="/settings/billing_subscription" onClick={() => setOpen(false)}>
                <Icon name="CreditCard" size={16} weight="bold" />
                Billing
              </UserMenuLink>
            </>
          )}
          <UserMenuLink href="/settings/general" onClick={() => setOpen(false)}>
            <Icon name="Gear" size={isHeader ? 20 : 16} weight="bold" />
            Settings
          </UserMenuLink>
          <button
            type="button"
            className={`koala-sidebar-user__link${isHeader ? '' : ' koala-sidebar-user__link--danger'}`}
            role="menuitem"
            onClick={() => { void signOut(); }}
          >
            <Icon name="SignOut" size={isHeader ? 20 : 16} weight="bold" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
