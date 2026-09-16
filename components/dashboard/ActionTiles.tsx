import React from 'react';
import Link from 'next/link';
import { Icon } from '../koala/icons/Icon';

export type ActionTile = { key: string; title: string; description: string; href: string; icon: string; disabled?: boolean };

const Inner = ({ t }: { t: ActionTile }) => (
  <>
    <span className="dash-tile__icon"><Icon name={t.icon} size={22} /></span>
    <span>
      <span className="dash-tile__title">{t.title}</span>
      <span className="dash-tile__sub">{t.description}</span>
    </span>
  </>
);

/** The three things a user comes to the dashboard to do. A disabled tile is inert while
 *  the domain analysis runs. */
export default function ActionTiles({ tiles }: { tiles: ActionTile[] }) {
  return (
    <div className="dash-tiles" data-testid="dashboard-action-tiles">
      {tiles.map((t) => (t.disabled ? (
        // A real link kept in the a11y tree, announced disabled and skipped by Tab, so
        // screen-reader users know the action exists but is paused.
        <a
          key={t.key}
          className="dash-tile"
          href={t.href}
          aria-disabled="true"
          tabIndex={-1}
          aria-label={`${t.title} — disabled while the domain analysis runs`}
          onClick={(e) => e.preventDefault()}
        >
          <Inner t={t} />
        </a>
      ) : (
        <Link key={t.key} href={t.href}>
          <a className="dash-tile"><Inner t={t} /></a>
        </Link>
      )))}
    </div>
  );
}
