import React from 'react';
import Link from 'next/link';

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RecommendationsIcon = () => (
  <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true">
    <path d="M22.2 4.4c.5 5.1 5.8 6.5 7.6 11.2 1.8 4.5.5 10.4-4.6 13.4 1.1-3.5-.4-5.8-2.6-8.2.1 4.9-2.8 7.5-6.5 8.5-4.6-2.3-6.7-6.3-5.8-11.2.8-4.6 5.8-7.5 6.5-12.9 2.1 1.4 3.9 3.3 5.4 5.6.6-1.9.5-3.8 0-6.4Z" fill="#FF5B49" />
    <path d="M20.5 30.2c-2.4-.8-4.1-2.8-4-5.4 0-2.2 1.6-3.8 3.2-5.4.3 2.7 2.7 3.4 3.4 5.8.6 2-.2 3.9-2.6 5Z" fill="#FFB199" />
  </svg>
);

const KeywordIcon = () => (
  <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true">
    <rect x="7" y="9" width="28" height="24" rx="5" fill="var(--koala-bg-secondary)" stroke="var(--koala-border-secondary)" strokeWidth="1.5" />
    <path d="M14 17h14M14 22h10M14 27h14" stroke="var(--koala-text-primary)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ContentAuditIcon = () => (
  <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true">
    <rect x="9" y="7" width="19" height="26" rx="4" fill="var(--koala-status-success-bg)" stroke="var(--koala-status-success)" strokeWidth="1.5" />
    <path d="M14 15h9M14 20h7M14 25h5" stroke="var(--koala-status-success)" strokeWidth="2" strokeLinecap="round" />
    <circle cx="29" cy="28" r="5" fill="var(--koala-bg-primary)" stroke="var(--koala-status-success)" strokeWidth="2" />
    <path d="m32.8 31.8 3.2 3.2" stroke="var(--koala-status-success)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export type ArticleStartLinks = { recommendations: string; keyword: string; contentAudit: string };

const OPTIONS: Array<{ key: keyof ArticleStartLinks; title: string; description: string; icon: React.ReactNode }> = [
  { key: 'recommendations', title: 'Recommendations', description: 'Start with one of the suggested actions', icon: <RecommendationsIcon /> },
  { key: 'keyword', title: 'Your keyword', description: 'Create content based on the keyword you provide', icon: <KeywordIcon /> },
  { key: 'contentAudit', title: 'Content Audit', description: 'Optimize your existing content', icon: <ContentAuditIcon /> },
];

/** The Content page before the first article: three ways to start. */
export default function ArticleEmptyStart({ links }: { links: ArticleStartLinks }) {
  return (
    <div className="article-empty-start">
      <h2 className="article-empty-start__title">How do you want to start?</h2>
      <div className="article-empty-start__grid">
        {OPTIONS.map((o) => (
          <Link href={links[o.key]} key={o.key}>
            <a className="article-empty-start__card">
              <div className="article-empty-start__icon">{o.icon}</div>
              <span className="article-empty-start__name">{o.title}<Arrow /></span>
              <span className="article-empty-start__desc">{o.description}</span>
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
}
