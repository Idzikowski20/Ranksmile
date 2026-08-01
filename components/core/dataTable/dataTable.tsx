import React from 'react';

type DivProps = React.HTMLAttributes<HTMLDivElement>;

/** HeroUI-like secondary/primary table shell — gray frame, white rounded body. */
export const DataTable = React.forwardRef<HTMLDivElement, DivProps>(function DataTable(
  { className = '', children, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={`rs-data-table ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
});

export const DataTableScroll = React.forwardRef<HTMLDivElement, DivProps>(function DataTableScroll(
  { className = '', children, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={`rs-data-table__scroll ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
});

export function DataTableContent({
  className = '',
  minWidth,
  children,
  ...rest
}: DivProps & { minWidth?: number | string }) {
  return (
    <div
      className={`rs-data-table__content ${className}`.trim()}
      style={minWidth != null ? { minWidth } : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}

export function DataTableHeader({ className = '', children, ...rest }: DivProps) {
  return (
    <div className={`rs-data-table__header ${className}`.trim()} role="row" {...rest}>
      {children}
    </div>
  );
}

export function DataTableBody({ className = '', children, ...rest }: DivProps) {
  return (
    <div className={`rs-data-table__body ${className}`.trim()} role="rowgroup" {...rest}>
      {children}
    </div>
  );
}

export function DataTableRow({
  className = '',
  selected,
  children,
  ...rest
}: DivProps & { selected?: boolean }) {
  return (
    <div
      className={`rs-data-table__row ${selected ? 'rs-data-table__row--selected' : ''} ${className}`.trim()}
      role="row"
      data-selected={selected || undefined}
      {...rest}
    >
      {children}
    </div>
  );
}

export function DataTableEmpty({ children }: { children: React.ReactNode }) {
  return <div className="rs-data-table__empty">{children}</div>;
}
