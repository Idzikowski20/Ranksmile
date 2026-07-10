import React, { useState } from 'react';
import { faviconUrl } from '../../lib/faviconUrl';

type DomainFaviconProps = {
  domain: string;
  size?: number;
  alt?: string;
  style?: React.CSSProperties;
  className?: string;
};

/** Small domain favicon via /api/favicon proxy — plain img (not next/image). */
export default function DomainFavicon({
  domain,
  size = 20,
  alt = '',
  style,
  className,
}: DomainFaviconProps) {
  const [failed, setFailed] = useState(false);
  const src = faviconUrl(domain, size);

  if (!domain || failed) {
    return (
      <span
        aria-hidden={!alt}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: 4,
          background: '#E4E4E7',
          display: 'inline-block',
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  return (
    <img
      alt={alt}
      src={src}
      width={size}
      height={size}
      loading="lazy"
      className={className}
      onError={() => setFailed(true)}
      style={{ borderRadius: 4, flexShrink: 0, objectFit: 'contain', ...style }}
    />
  );
}
