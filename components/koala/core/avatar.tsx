import React, { forwardRef } from 'react';
import Image from 'next/image';
import { Flag } from '../icons/Flag';

type AvatarVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
export type AvatarBadge = 'none' | 'status' | 'flag' | 'certificate';

type AvatarProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src?: string;
  alt?: string;
  initials?: string;
  size?: number;
  variant?: AvatarVariant;
  className?: string;
  fallback?: boolean;
  onError?: () => void;
  /** Overlay mark — Figma Avatar `3950:49867`. */
  badge?: AvatarBadge;
  /** ISO country for `badge="flag"` (default US). */
  flagCode?: string;
};

const VARIANT_COLORS: Record<AvatarVariant, { bg: string; text: string }> = {
  primary:   { bg: '#F84416', text: '#fff' },
  secondary: { bg: '#FDE8D8', text: '#09090B' },
  success:   { bg: '#34D399', text: '#065F46' },
  warning:   { bg: '#FBBF24', text: '#92400E' },
  error:     { bg: '#F87171', text: '#991B1B' },
  info:      { bg: '#60A5FA', text: '#1E40AF' },
};

function badgePx(avatarSize: number): number {
  return Math.max(10, Math.round(avatarSize * 0.375));
}

function CertificateMark({ size }: { size: number }) {
  // Pad viewBox so scalloped points are not flush with the SVG edge
  // (flush edges look "cut" when any ancestor clips or subpixels round).
  return (
    <svg width={size} height={size} viewBox="-1 -1 22 22" aria-hidden="true" style={{ overflow: 'visible' }}>
      <path
        fill="#2563EB"
        d="M10 1.2l1.55 1.1 1.82-.4.72 1.72 1.72.72-.4 1.82 1.1 1.55-1.1 1.55.4 1.82-1.72.72-.72 1.72-1.82-.4L10 18.8l-1.55-1.1-1.82.4-.72-1.72-1.72-.72.4-1.82L3.5 11.55 4.6 10l-1.1-1.55-.4-1.82 1.72-.72.72-1.72 1.82.4L10 1.2z"
      />
      <path
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.6 10.1l2.1 2.1 4.5-4.5"
      />
    </svg>
  );
}

const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  (
    {
      src,
      alt = '',
      initials = '',
      size = 32,
      variant = 'primary',
      className = '',
      fallback = false,
      onError,
      badge = 'none',
      flagCode = 'US',
    },
    ref,
  ) => {
    const [imgError, setImgError] = React.useState(false);
    const showImage = !!src && !fallback && !imgError;
    const initial = (initials || alt || '?').charAt(0).toUpperCase();
    const colors = VARIANT_COLORS[variant];
    const mark = badgePx(size);

    return (
      <span
        ref={ref}
        className={`koala-avatar${badge !== 'none' ? ' koala-avatar--badged' : ''} ${className}`.trim()}
        style={{ width: size, height: size }}
        aria-hidden={!alt ? 'true' : undefined}
      >
        <span className="koala-avatar__media">
          {showImage ? (
            <Image
              alt={alt}
              src={src}
              width={size}
              height={size}
              className="koala-avatar-image"
              referrerPolicy="no-referrer"
              unoptimized
              onError={() => { setImgError(true); onError?.(); }}
            />
          ) : (
            <span className="koala-avatar-initial" style={{ background: colors.bg, color: colors.text }}>
              {initial}
            </span>
          )}
        </span>
        {badge === 'status' ? (
          <span className="koala-avatar__badge koala-avatar__badge--status" style={{ width: mark, height: mark }} aria-hidden="true" />
        ) : null}
        {badge === 'flag' ? (
          <span className="koala-avatar__badge koala-avatar__badge--flag" style={{ width: mark, height: mark }} aria-hidden="true">
            <Flag code={flagCode} size={Math.round(mark * 1.35)} />
          </span>
        ) : null}
        {badge === 'certificate' ? (
          <span
            className="koala-avatar__badge koala-avatar__badge--certificate"
            style={{ width: mark + 2, height: mark + 2 }}
            aria-hidden="true"
          >
            <CertificateMark size={mark + 2} />
          </span>
        ) : null}
      </span>
    );
  }
);
Avatar.displayName = 'Avatar';

type AvatarButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  avatar: React.ReactNode;
  size?: number;
};

const AvatarButton = forwardRef<HTMLButtonElement, AvatarButtonProps>(
  ({ avatar, size = 32, className = '', ...rest }, ref) => (
    <button ref={ref} className={`koala-avatar-button ${className}`} style={{ width: size, height: size, padding: 0 }} {...rest}>
      {avatar}
    </button>
  )
);
AvatarButton.displayName = 'AvatarButton';

export { Avatar, AvatarButton };
export default Avatar;
