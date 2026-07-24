import React from 'react';

export function normalizeFeature(f: string): string {
  return f.toLowerCase().replace(/[\s-]+/g, '_');
}

export function absoluteUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `https://${url}`;
}

export function SerpMiniIcon({ name }: { name: string }) {
  const n = normalizeFeature(name);
  const stroke = '#6A6772';
  if (n.includes('ai') || n.includes('sge')) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M6 1.5l1.2 2.4 2.6.4-1.9 1.9.5 2.6L6 7.6 3.6 8.8l.5-2.6-1.9-1.9 2.6-.4L6 1.5z" stroke={stroke} strokeWidth="1" />
      </svg>
    );
  }
  if (n.includes('image')) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <rect x="1.5" y="2" width="9" height="8" rx="1" stroke={stroke} strokeWidth="1" />
        <circle cx="4.2" cy="4.5" r="1" fill={stroke} />
        <path d="M1.8 8.5l2.4-2.2 1.6 1.4 2-2.1 2.4 2.9" stroke={stroke} strokeWidth="1" />
      </svg>
    );
  }
  if (n.includes('video')) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <rect x="1.5" y="2.5" width="6.5" height="7" rx="1" stroke={stroke} strokeWidth="1" />
        <path d="M8.5 4.5l2-1.2v5.4l-2-1.2V4.5z" stroke={stroke} strokeWidth="1" />
      </svg>
    );
  }
  if (n.includes('people') || n.includes('paa') || n.includes('ask')) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <circle cx="6" cy="6" r="4.2" stroke={stroke} strokeWidth="1" />
        <path d="M4.5 5h.01M6 5h.01M7.5 5h.01M4.8 7.2c.6.6 1.8.6 2.4 0" stroke={stroke} strokeWidth="1" strokeLinecap="round" />
      </svg>
    );
  }
  if (n.includes('review') || n.includes('star')) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M6 1.8l1.1 2.2 2.4.4-1.7 1.7.4 2.4L6 7.4 3.8 8.5l.4-2.4L2.5 4.4l2.4-.4L6 1.8z" stroke={stroke} strokeWidth="1" />
      </svg>
    );
  }
  if (n.includes('knowledge') || n.includes('panel')) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <rect x="2" y="1.5" width="8" height="9" rx="1" stroke={stroke} strokeWidth="1" />
        <path d="M4 4h4M4 6h4M4 8h2.5" stroke={stroke} strokeWidth="1" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="5" cy="5" r="3" stroke={stroke} strokeWidth="1" />
      <path d="M7.2 7.2L10 10" stroke={stroke} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
