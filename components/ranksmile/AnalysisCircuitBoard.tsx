'use client';

import * as React from 'react';
import CircuitBoard, {
  type CircuitConnection,
  type CircuitNode,
  type CircuitNodeStatus,
} from './CircuitBoard';
import type { DeepAnalysisUiState, StepVisualStatus } from '../../lib/deepAnalysisProgress';

const iconProps = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true as const };

function IconFile() {
  return (
    <svg {...iconProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg {...iconProps}>
      <path
        d="M12 3l1.2 4.2L17.5 8.5 13.2 9.8 12 14l-1.2-4.2L6.5 8.5l4.3-1.3L12 3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M18 14l.6 2.1L20.5 17l-1.9.6L18 19.5l-.6-1.9L15.5 17l1.9-.9L18 14z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconGauge() {
  return (
    <svg {...iconProps}>
      <path d="M4.5 15.5a8 8 0 1 1 15 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M12 15.5l3.5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="15.5" r="1.25" fill="currentColor" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconFetch() {
  return (
    <svg {...iconProps}>
      <path d="M12 3v12M8 11l4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg {...iconProps}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M3 13l9 5 9-5M3 17l9 5 9-5" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

function IconEditor() {
  return (
    <svg {...iconProps}>
      <path d="M4 19h16M7 15l9.5-9.5a1.5 1.5 0 0 1 2.1 2.1L9.2 17.2 5.5 18l.8-3.7z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function visualToNode(status: StepVisualStatus | undefined, fallback: CircuitNodeStatus = 'inactive'): CircuitNodeStatus {
  if (status === 'running') return 'processing';
  if (status === 'done') return 'active';
  return fallback;
}

function worstOf(statuses: StepVisualStatus[]): CircuitNodeStatus {
  if (statuses.some((s) => s === 'running')) return 'processing';
  if (statuses.length > 0 && statuses.every((s) => s === 'done')) return 'active';
  if (statuses.some((s) => s === 'done')) return 'active';
  return 'inactive';
}

export type AnalysisCircuitVariant = 'deep-analysis' | 'import';

export type AnalysisCircuitBoardProps = {
  variant?: AnalysisCircuitVariant;
  /** Live deep-analysis sidebar state — drives node glow. */
  state?: DeepAnalysisUiState | null;
  /** Import scrape in progress. */
  importing?: boolean;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
};

function deepAnalysisNodes(state?: DeepAnalysisUiState | null): CircuitNode[] {
  const google = state?.googleSearch ?? [];
  const ai = state?.aiSearch ?? [];
  const byKey = (key: string) => google.find((s) => s.key === key)?.status ?? ai.find((s) => s.key === key)?.status;

  const articleStatus: CircuitNodeStatus =
    state?.error ? 'error'
      : state?.isComplete ? 'active'
        : google.some((s) => s.status !== 'pending') || ai.some((s) => s.status !== 'pending')
          ? 'active'
          : 'processing';

  const serpStatus = worstOf([
    byKey('serp_results') || 'pending',
    byKey('serp_crawl') || 'pending',
  ]);

  const aiStatus = worstOf([
    byKey('ai_prompts') || 'pending',
    byKey('ai_scrape') || 'pending',
  ]);

  const scoreStatus = worstOf([
    byKey('serp_scores') || 'pending',
    byKey('ai_guidelines') || 'pending',
  ]);

  return [
    { id: 'article', x: 44, y: 78, label: 'Article', icon: <IconFile />, status: articleStatus },
    { id: 'serp', x: 140, y: 40, label: 'SERP', icon: <IconSearch />, status: serpStatus },
    { id: 'ai', x: 140, y: 116, label: 'AI Search', icon: <IconSpark />, status: aiStatus },
    { id: 'score', x: 236, y: 78, label: 'Score', icon: <IconGauge />, status: scoreStatus },
  ];
}

const DEEP_EDGES: Array<{ from: string; to: string }> = [
  { from: 'article', to: 'serp' },
  { from: 'article', to: 'ai' },
  { from: 'serp', to: 'score' },
  { from: 'ai', to: 'score' },
];

const IMPORT_EDGES: Array<{ from: string; to: string }> = [
  { from: 'url', to: 'fetch' },
  { from: 'url', to: 'parse' },
  { from: 'fetch', to: 'editor' },
  { from: 'parse', to: 'editor' },
];

/**
 * Pulse only on edges that touch a processing node and never through inactive ones.
 * Sidecar deep-analysis is sequential (SERP → AI), so only the live branch animates.
 */
export function shouldAnimateCircuitEdge(
  fromStatus: CircuitNodeStatus | undefined,
  toStatus: CircuitNodeStatus | undefined,
): boolean {
  if (!fromStatus || !toStatus) return false;
  if (fromStatus === 'inactive' || toStatus === 'inactive') return false;
  if (fromStatus === 'error' || toStatus === 'error') return false;
  return fromStatus === 'processing' || toStatus === 'processing';
}

function connectionsFor(nodes: CircuitNode[], edges: Array<{ from: string; to: string }>): CircuitConnection[] {
  const statusOf = (id: string) => nodes.find((n) => n.id === id)?.status;
  return edges.map(({ from, to }) => ({
    from,
    to,
    animated: shouldAnimateCircuitEdge(statusOf(from), statusOf(to)),
  }));
}

function importNodes(importing?: boolean): CircuitNode[] {
  const mid: CircuitNodeStatus = importing ? 'processing' : 'active';
  return [
    { id: 'url', x: 44, y: 78, label: 'URL', icon: <IconGlobe />, status: 'active' },
    { id: 'fetch', x: 140, y: 40, label: 'Fetch', icon: <IconFetch />, status: mid },
    { id: 'parse', x: 140, y: 116, label: 'Parse', icon: <IconLayers />, status: mid },
    { id: 'editor', x: 236, y: 78, label: 'Editor', icon: <IconEditor />, status: importing ? 'inactive' : 'active' },
  ];
}

/** Compact circuit viz for deep analysis / import progress. */
export default function AnalysisCircuitBoard({
  variant = 'deep-analysis',
  state = null,
  importing = true,
  width = 280,
  height = 168,
  style,
  ...rest
}: AnalysisCircuitBoardProps & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>) {
  const base = variant === 'import' ? importNodes(importing) : deepAnalysisNodes(state);
  const connections = connectionsFor(base, variant === 'import' ? IMPORT_EDGES : DEEP_EDGES);
  const sx = width / 280;
  const sy = height / 168;
  const nodes = base.map((n) => ({ ...n, x: Math.round(n.x * sx), y: Math.round(n.y * sy) }));

  return (
    <CircuitBoard
      nodes={nodes}
      connections={connections}
      width={width}
      height={height}
      variant="light"
      pulseSpeed={variant === 'deep-analysis' ? 2.4 : 1.8}
      showGrid
      style={style}
      {...rest}
    />
  );
}
