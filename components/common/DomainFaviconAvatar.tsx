import React, { useState } from 'react';
import { faviconUrl } from '../../lib/faviconUrl';

export function cleanDomainHost(domain?: string | null): string {
  return (domain || '')
    .replace(/^sc-domain:/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .trim();
}

type DomainFaviconAvatarProps = {
  domain?: string | null;
  size?: number;
  className?: string;
  plain?: boolean;
};

const DomainFaviconAvatar = ({ domain, size = 24, className = '', plain = false }: DomainFaviconAvatarProps) => {
  const [err, setErr] = useState(false);
  const host = cleanDomainHost(domain);
  const initial = (host || '?').charAt(0).toUpperCase();
  const isShellAvatar = className.includes('sentry-nav-avatar');
  const plainClass = plain ? 'sentry-org-domain-avatar--plain' : '';
  const rootClass = isShellAvatar
    ? className
    : `sentry-org-domain-avatar ${plainClass} ${className}`.trim();

  return (
    <span
      className={rootClass}
      style={isShellAvatar ? undefined : { width: size, height: size }}
      aria-hidden="true"
    >
      {host && !err ? (
        <img
          src={faviconUrl(host, 64)}
          alt=""
          width={isShellAvatar ? undefined : size}
          height={isShellAvatar ? undefined : size}
          onError={() => setErr(true)}
        />
      ) : (
        <span className="sentry-org-domain-avatar-fallback">{initial}</span>
      )}
    </span>
  );
};

export default DomainFaviconAvatar;
