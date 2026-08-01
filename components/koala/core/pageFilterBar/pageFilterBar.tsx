import React, { Children } from 'react';

type PageFilterBarProps = React.HTMLAttributes<HTMLDivElement> & {
  condensed?: boolean;
};

/** Sentry-style segmented filter bar — children should be CompactSelect wrappers. */
export function PageFilterBar({ children, condensed, className = '', ...rest }: PageFilterBarProps) {
  const count = Children.count(children);
  return (
    <div
      className={`koala-page-filter-bar ${condensed ? 'koala-page-filter-bar--condensed' : ''} ${className}`}
      data-list-size={count}
      {...rest}
    >
      {children}
    </div>
  );
}

export default PageFilterBar;
