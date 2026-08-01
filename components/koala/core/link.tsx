import React, { forwardRef } from 'react';
import NextLink from 'next/link';

type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  disabled?: boolean;
  external?: boolean;
};

const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, disabled, external, className = '', children, ...rest }, ref) => {
    const cls = `koala-link ${disabled ? 'koala-link--disabled' : ''} ${className}`;
    if (disabled) {
      return (
        <span className={cls} aria-disabled="true">
          {children}
        </span>
      );
    }
    if (external || href.startsWith('http')) {
      return (
        <a
          ref={ref}
          href={href}
          className={cls}
          target="_blank"
          rel="noreferrer noopener"
          {...rest}
        >
          {children}
        </a>
      );
    }
    return (
      <NextLink href={href} passHref legacyBehavior>
        <a ref={ref} className={cls} {...rest}>
          {children}
        </a>
      </NextLink>
    );
  }
);
Link.displayName = 'Link';
export default Link;
