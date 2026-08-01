import React from 'react';
import Link from 'next/link';
import { Icon } from '../koala/icons/Icon';

export type SettingsPageSlug =
  | 'general'
  | 'people'
  | 'brand_knowledge'
  | 'google_search_console'
  | 'wordpress'
  | 'api'
  | 'billing_subscription'
  | 'billing_usage'
  | 'billing_invoices'
  | 'billing_details'
  | 'members'
  | 'workspace_general'
  | 'custom_voices'
  | 'profile'
  | 'notifications'
  | 'masterclass';

type NavItem = {
  slug: SettingsPageSlug;
  label: string;
  icon: string;
  href: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

/** Ranksmile settings mapped to Koala Settings secondary rail (`6343:27909`). */
export const SETTINGS_NAV_GROUPS: NavGroup[] = [
  {
    title: 'Account',
    items: [
      { slug: 'profile', label: 'Profile', icon: 'User', href: '/settings/profile' },
      { slug: 'notifications', label: 'Notifications', icon: 'Bell', href: '/settings/notifications' },
    ],
  },
  {
    title: 'Organization',
    items: [
      { slug: 'general', label: 'General', icon: 'Buildings', href: '/settings/general' },
      { slug: 'people', label: 'People', icon: 'Users', href: '/settings/people' },
    ],
  },
  {
    title: 'Billing',
    items: [
      { slug: 'billing_subscription', label: 'Subscription', icon: 'CreditCard', href: '/settings/billing_subscription' },
      { slug: 'billing_usage', label: 'Usage', icon: 'ChartBar', href: '/settings/billing_usage' },
      { slug: 'billing_invoices', label: 'Billing History', icon: 'Receipt', href: '/settings/billing_invoices' },
      { slug: 'billing_details', label: 'Payment methods', icon: 'Wallet', href: '/settings/billing_details' },
    ],
  },
  {
    title: 'Integrations',
    items: [
      { slug: 'google_search_console', label: 'Search Console', icon: 'MagnifyingGlass', href: '/settings/google_search_console' },
      { slug: 'wordpress', label: 'WordPress', icon: 'Globe', href: '/settings/wordpress' },
      { slug: 'api', label: 'API', icon: 'Code', href: '/settings/api' },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { slug: 'workspace_general', label: 'General', icon: 'Gear', href: '/settings/workspace_general' },
      { slug: 'members', label: 'Members', icon: 'UsersThree', href: '/settings/members' },
      { slug: 'brand_knowledge', label: 'Brand Knowledge', icon: 'BookOpen', href: '/settings/brand_knowledge' },
      { slug: 'custom_voices', label: 'Custom Voices', icon: 'Microphone', href: '/settings/custom_voices' },
    ],
  },
];

type Props = {
  current: SettingsPageSlug;
};

export default function SettingsNav({ current }: Props) {
  return (
    <aside className="koala-settings-nav" aria-label="Settings">
      <div className="koala-settings-nav__scroll styled-scrollbar">
        <div className="koala-settings-nav__title">Settings</div>
        {SETTINGS_NAV_GROUPS.map((group) => (
          <div key={group.title} className="koala-settings-nav__group">
            <div className="koala-settings-nav__group-title">{group.title}</div>
            <ul className="koala-settings-nav__list">
              {group.items.map((item) => {
                const active = current === item.slug;
                return (
                  <li key={item.slug}>
                      <Link href={item.href} passHref>
                        <a
                          className={`koala-settings-nav__item${active ? ' koala-settings-nav__item--active' : ''}`}
                          aria-current={active ? 'page' : undefined}
                        >
                          <span className="koala-settings-nav__item-inner">
                            <span className="koala-settings-nav__icon" aria-hidden="true">
                              <Icon name={item.icon} size={16} weight="bold" />
                            </span>
                            <span className="koala-settings-nav__label">{item.label}</span>
                          </span>
                        </a>
                      </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}
