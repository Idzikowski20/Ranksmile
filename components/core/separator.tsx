import React, { forwardRef } from 'react';

type SeparatorProps = React.HTMLAttributes<HTMLHRElement> & {
  orientation?: 'horizontal' | 'vertical';
};

const Separator = forwardRef<HTMLHRElement, SeparatorProps>(
  ({ orientation = 'horizontal', className = '', ...rest }, ref) => (
    <hr
      ref={ref}
      aria-orientation={orientation}
      className={`sentry-separator sentry-separator--${orientation} ${className}`}
      {...rest}
    />
  )
);
Separator.displayName = 'Separator';
export default Separator;
