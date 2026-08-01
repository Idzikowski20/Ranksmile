import React from 'react';
import { Icon } from '../../icons';

type DivProps = React.HTMLAttributes<HTMLDivElement>;

/** Koala UI v11 table shell — Minimal: no outer box, hairline rows only (Figma Tables). */
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

type CellLayout = {
  width?: number | string;
  flex?: number | string;
  minWidth?: number | string;
  align?: 'start' | 'center' | 'end';
};

function cellStyle(layout: CellLayout): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (layout.width != null) style.width = layout.width;
  if (layout.flex != null) style.flex = layout.flex;
  if (layout.minWidth != null) style.minWidth = layout.minWidth;
  if (layout.align === 'center') style.justifyContent = 'center';
  if (layout.align === 'end') style.justifyContent = 'flex-end';
  return style;
}

export type DataTableHeadCellProps = DivProps & CellLayout & {
  sortable?: boolean;
  sorted?: 'asc' | 'desc' | false;
  onSort?: () => void;
};

/** Header cell — sentence-case label + optional sort glyph (Figma). */
export function DataTableHeadCell({
  className = '',
  width,
  flex,
  minWidth,
  align,
  sortable,
  sorted,
  onSort,
  children,
  style,
  ...rest
}: DataTableHeadCellProps) {
  const interactive = sortable && onSort;
  return (
    <div
      className={`rs-data-table__th ${align ? `rs-data-table__th--${align}` : ''} ${className}`.trim()}
      role="columnheader"
      style={{ ...cellStyle({ width, flex, minWidth, align }), ...style }}
      {...rest}
    >
      {interactive ? (
        <button type="button" className="rs-data-table__sort" onClick={onSort} data-sorted={sorted || undefined}>
          <span>{children}</span>
          <Icon name="ArrowsDownUp" size={14} />
        </button>
      ) : (
        children
      )}
    </div>
  );
}

export type DataTableCellProps = DivProps & CellLayout & {
  /** Stack label + meta vertically. */
  stack?: boolean;
};

/** Body cell — no vertical rules; padding from CSS SoT. */
export function DataTableCell({
  className = '',
  width,
  flex,
  minWidth,
  align,
  stack,
  children,
  style,
  ...rest
}: DataTableCellProps) {
  return (
    <div
      className={`rs-data-table__cell ${align ? `rs-data-table__cell--${align}` : ''} ${stack ? 'rs-data-table__cell--stack' : ''} ${className}`.trim()}
      role="cell"
      style={{ ...cellStyle({ width, flex, minWidth, align }), ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
