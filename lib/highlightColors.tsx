import React from 'react';
import type { Editor } from '@tiptap/core';

export interface HighlightColor {
  label: string;
  color: string | null;
  swatch: string;
}

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  { label: 'Default', color: null, swatch: '#FFFFFF' },
  { label: 'Purple', color: '#C5B8FE', swatch: '#C5B8FE' },
  { label: 'Blue', color: '#BEDBFF', swatch: '#BEDBFF' },
  { label: 'Green', color: '#7AEB9D', swatch: '#7AEB9D' },
  { label: 'Yellow', color: '#FFCB6B', swatch: '#FFCB6B' },
  { label: 'Red', color: '#FFBBBD', swatch: '#FFBBBD' },
];

export const HighlightSwatchIcon = ({ color }: { color: string }) => (
  <div style={{ width: 20, height: 20, borderRadius: 4, background: color, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
    <svg viewBox="0 0 256 256" width={14} height={14} style={{ display: 'inline-block', flexShrink: 0 }}>
      <path fill={color === '#FFFFFF' ? '#18181B' : '#FFFFFF'} d="M208 56v32a8 8 0 0 1-16 0V64h-56v128h24a8 8 0 0 1 0 16H96a8 8 0 0 1 0-16h24V64H64v24a8 8 0 0 1-16 0V56a8 8 0 0 1 8-8h144a8 8 0 0 1 8 8" />
    </svg>
  </div>
);

/** Check if a highlight color is active on the editor */
export function isHighlightActive(editor: Editor, color: string | null): boolean {
  return color === null ? !editor.isActive('highlight') : editor.isActive('highlight', { color });
}
