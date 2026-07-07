import React from 'react';

type ToolRibbonProps = React.HTMLAttributes<HTMLDivElement>;

/** Sentry ToolRibbon — flex wrap row for filters + search + actions. */
export function ToolRibbon({ children, className = '', ...rest }: ToolRibbonProps) {
  return (
    <div className={`sentry-tool-ribbon ${className}`} {...rest}>
      {children}
    </div>
  );
}

export default ToolRibbon;
