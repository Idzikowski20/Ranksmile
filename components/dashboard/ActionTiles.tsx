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
        <span key={t.key} className="dash-tile" aria-disabled="true"><Inner t={t} /></span>
      ) : (
        <Link key={t.key} href={t.href}>
          <a className="dash-tile"><Inner t={t} /></a>
        </Link>
      )))}
    </div>
  );
}
