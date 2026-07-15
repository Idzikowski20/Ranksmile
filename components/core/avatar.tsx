import React, { forwardRef } from 'react';
import Image from 'next/image';

type AvatarVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

type AvatarProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src?: string;
  alt?: string;
  initials?: string;
  size?: number;
  variant?: AvatarVariant;
  className?: string;
  fallback?: boolean;
  onError?: () => void;
};

const VARIANT_COLORS: Record<AvatarVariant, { bg: string; text: string }> = {
  primary:   { bg: '#F29964', text: '#fff' },
  secondary: { bg: '#FDE8D8', text: '#09090B' },
  success:   { bg: '#34D399', text: '#065F46' },
  warning:   { bg: '#FBBF24', text: '#92400E' },
  error:     { bg: '#F87171', text: '#991B1B' },
  info:      { bg: '#60A5FA', text: '#1E40AF' },
};

const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  ({ src, alt = '', initials = '', size = 32, variant = 'primary', className = '', fallback = false, onError }, ref) => {
    const [imgError, setImgError] = React.useState(false);
    const showImage = !!src && !fallback && !imgError;
    const initial = (initials || alt || '?').charAt(0).toUpperCase();
    const colors = VARIANT_COLORS[variant];
    return (
      <span
        ref={ref}
        className={`sentry-avatar ${className}`}
        style={{ width: size, height: size }}
        aria-hidden={!alt ? 'true' : undefined}
      >
        {showImage ? (
          <Image
            alt={alt}
            src={src}
            width={size}
            height={size}
            className="sentry-avatar-image"
            referrerPolicy="no-referrer"
            unoptimized
            onError={() => { setImgError(true); onError?.(); }}
          />
        ) : (
          <span className="sentry-avatar-initial" style={{ background: colors.bg, color: colors.text }}>
            {initial}
          </span>
        )}
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
    <button ref={ref} className={`sentry-avatar-button ${className}`} style={{ width: size, height: size, padding: 0 }} {...rest}>
      {avatar}
    </button>
  )
);
AvatarButton.displayName = 'AvatarButton';

export { Avatar, AvatarButton };
export default Avatar;
