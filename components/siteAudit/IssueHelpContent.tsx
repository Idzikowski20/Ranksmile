import React from 'react';
import { Badge } from '../core';
import { getCatalogEntry } from '../../lib/siteAudit/issueCatalog';
import type { IssueHelpContent as IssueHelp } from '../../lib/siteAudit/types';

const LINK_BLUE = '#2563EB';

export function IssueAboutBlock({ help }: { help: IssueHelp }) {
  return (
    <section className="sentry-issue-aside-block">
      <h3 className="sentry-issue-aside-heading">About the issue</h3>
      {help.about.map((para) => (
        <p key={para.slice(0, 48)} className="sentry-issue-aside-text">{para}</p>
      ))}
      {help.bullets && (
        <ul className="sentry-issue-aside-list">
          {help.bullets.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
      {help.badge && <Badge variant="experimental">{help.badge}</Badge>}
      {help.badgeExtra?.map((para) => (
        <p key={para.slice(0, 48)} className="sentry-issue-aside-text">{para}</p>
      ))}
      {help.articleLinks && help.articleLinks.length > 0 && (
        <p className="sentry-issue-aside-text">
          For more information:
          {' '}
          {help.articleLinks.map((link, idx) => (
            <span key={link.href}>
              {idx > 0 && ' · '}
              <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ color: LINK_BLUE }}>
                {link.label}
              </a>
            </span>
          ))}
        </p>
      )}
      <p className="sentry-issue-aside-meta">
        <strong>Category:</strong>
        {' '}
        {help.category}
      </p>
    </section>
  );
}

export function IssueFixBlock({ help }: { help: IssueHelp }) {
  return (
    <section className="sentry-issue-aside-block sentry-issue-aside-block--fix">
      <h3 className="sentry-issue-aside-heading">How to fix</h3>
      {help.fixBullets ? (
        <ul className="sentry-issue-aside-list">
          {help.fix.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        help.fix.map((para) => (
          <p key={para.slice(0, 48)} className="sentry-issue-aside-text">{para}</p>
        ))
      )}
    </section>
  );
}

/** Aside help panel: About + How to fix from the issue catalog. */
export default function IssueHelpContent({ issueId }: { issueId: string }) {
  const catalog = getCatalogEntry(issueId);
  if (!catalog) return null;

  return (
    <div className="sentry-issue-aside">
      <IssueAboutBlock help={catalog.help} />
      <IssueFixBlock help={catalog.help} />
    </div>
  );
}
