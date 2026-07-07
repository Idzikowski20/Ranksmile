import React from 'react';

export function SentryTable({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`sentry-table-wrap ${className}`}>
      <table className="sentry-table">{children}</table>
    </div>
  );
}

export function SentryTableHead({ children }: { children: React.ReactNode }) {
  return <thead className="sentry-table-head">{children}</thead>;
}

export function SentryTableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="sentry-table-body">{children}</tbody>;
}

export function SentryTableRow({ children, className = '', onClick }: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr className={`sentry-table-row ${className}`} onClick={onClick}>
      {children}
    </tr>
  );
}

export function SentryTableCell({ children, className = '', align, style, colSpan }: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  style?: React.CSSProperties;
  colSpan?: number;
}) {
  return (
    <td
      className={`sentry-table-cell ${align ? `sentry-table-cell--${align}` : ''} ${className}`}
      style={style}
      colSpan={colSpan}
    >
      {children}
    </td>
  );
}

export function SentryTableHeaderCell({ children, className = '', align, style }: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  style?: React.CSSProperties;
}) {
  return (
    <th
      className={`sentry-table-th ${align ? `sentry-table-th--${align}` : ''} ${className}`}
      scope="col"
      style={style}
    >
      {children}
    </th>
  );
}
