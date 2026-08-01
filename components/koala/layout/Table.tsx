import React from 'react';

export function KoalaTable({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`koala-table-wrap ${className}`}>
      <table className="koala-table">{children}</table>
    </div>
  );
}

export function KoalaTableHead({ children }: { children: React.ReactNode }) {
  return <thead className="koala-table-head">{children}</thead>;
}

export function KoalaTableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="koala-table-body">{children}</tbody>;
}

export function KoalaTableRow({ children, className = '', onClick }: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr className={`koala-table-row ${className}`} onClick={onClick}>
      {children}
    </tr>
  );
}

export function KoalaTableCell({ children, className = '', align, style, colSpan }: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  style?: React.CSSProperties;
  colSpan?: number;
}) {
  return (
    <td
      className={`koala-table-cell ${align ? `koala-table-cell--${align}` : ''} ${className}`}
      style={style}
      colSpan={colSpan}
    >
      {children}
    </td>
  );
}

export function KoalaTableHeaderCell({ children, className = '', align, style }: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  style?: React.CSSProperties;
}) {
  return (
    <th
      className={`koala-table-th ${align ? `koala-table-th--${align}` : ''} ${className}`}
      scope="col"
      style={style}
    >
      {children}
    </th>
  );
}

/** @deprecated Use KoalaTable* */
export const SentryTable = KoalaTable;
export const SentryTableHead = KoalaTableHead;
export const SentryTableBody = KoalaTableBody;
export const SentryTableRow = KoalaTableRow;
export const SentryTableCell = KoalaTableCell;
export const SentryTableHeaderCell = KoalaTableHeaderCell;
