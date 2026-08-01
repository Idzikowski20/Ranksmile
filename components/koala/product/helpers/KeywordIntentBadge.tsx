import React from 'react';
import type { SearchIntent } from '../../../../lib/organicResearch/types';

const FONT = 'var(--font-family-primary)';

/** Chromatic intent letters — single source (SEO domain semantics). */
const INTENT_META: Record<NonNullable<SearchIntent>, { letter: string; bg: string; color: string; title: string }> = {
  // check-koala-tokens-ignore — intentional Semrush-style intent palette
  informational: {
    letter: 'I',
    bg: '#a6b8f9',
    color: '#FFFFFF',
    title: 'Informational\nThe user wants to find an answer to a specific question',
  },
  commercial: {
    letter: 'C',
    bg: '#c9b0e8',
    color: '#FFFFFF',
    title: 'Commercial\nThe user wants to investigate brands or services',
  },
  transactional: {
    letter: 'T',
    bg: '#9dd4b8',
    color: '#FFFFFF',
    title: 'Transactional\nThe user wants to complete an action (conversion)',
  },
  navigational: {
    letter: 'N',
    bg: '#f5c89a',
    color: '#FFFFFF',
    title: 'Navigational\nThe user wants to find a specific page or site',
  },
};

export type KeywordIntentBadgeProps = {
  intent: SearchIntent;
  /** When true, show full label instead of letter chip (research tables). */
  label?: boolean;
};

export function KeywordIntentBadge({ intent, label = false }: KeywordIntentBadgeProps) {
  if (!intent) {
    return <span style={{ color: 'var(--koala-text-tertiary)', fontFamily: FONT }}>—</span>;
  }
  const m = INTENT_META[intent];
  if (label) {
    return (
      <span
        title={m.title}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: FONT,
          color: 'var(--koala-text-secondary)',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 16,
            height: 16,
            borderRadius: 2,
            background: m.bg,
            color: m.color,
            fontSize: 11,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {m.letter}
        </span>
        {intent}
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={m.title.replace('\n', ': ')}
      title={m.title}
      style={{
        display: 'inline-flex',
        width: 16,
        height: 16,
        borderRadius: 2,
        alignItems: 'center',
        justifyContent: 'center',
        background: m.bg,
        color: m.color,
        fontSize: 12,
        lineHeight: '16px',
        fontWeight: 700,
        fontFamily: FONT,
        flexShrink: 0,
      }}
    >
      {m.letter}
    </span>
  );
}

export default KeywordIntentBadge;
