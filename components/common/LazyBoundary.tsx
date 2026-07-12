import React, { Suspense } from 'react';

type LazyBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

/** Shared Suspense wrapper for dynamic imports. */
export default function LazyBoundary({ children, fallback = null }: LazyBoundaryProps) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
