import React from 'react';

export function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M14.388 1.079a.998.998 0 0 0-.39-.079H9.75a1.001 1.001 0 1 0 0 2.003h1.83L5.298 9.29a1.001 1.001 0 0 0 1.416 1.416l6.284-6.288v1.83a1.001 1.001 0 1 0 2.003 0V2.002a.997.997 0 0 0-.612-.922Z" />
      <path d="M1 5a1 1 0 0 1 1-1h4v2H3v7h7v-3h2v4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5Z" />
    </svg>
  );
}

type UrlCellProps = {
  url: string;
  classPrefix?: string;
};

export function UrlCell({ url, classPrefix = 'koala-issue' }: UrlCellProps) {
  if (!url || url === '—') return <span>—</span>;
  return (
    <div className={`${classPrefix}-url-cell`}>
      <a href={url} target="_blank" rel="noreferrer noopener" className={`${classPrefix}-url-link`}>
        {url}
      </a>
      <a href={url} target="_blank" rel="noreferrer noopener" aria-label={`Go to ${url}`} className={`${classPrefix}-url-ext`}>
        <ExternalLinkIcon />
      </a>
    </div>
  );
}
