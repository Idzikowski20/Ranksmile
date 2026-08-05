'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';

export type CircuitNodeStatus = 'active' | 'inactive' | 'processing' | 'error';
export type CircuitNodeSize = 'sm' | 'md' | 'lg';

export interface CircuitNode {
  id: string;
  x: number;
  y: number;
  label?: string;
  icon?: React.ReactNode;
  status?: CircuitNodeStatus;
  size?: CircuitNodeSize;
}

export interface CircuitConnection {
  from: string;
  to: string;
  animated?: boolean;
  bidirectional?: boolean;
  color?: string;
  pulseColor?: string;
}

export interface CircuitBoardProps extends React.HTMLAttributes<HTMLDivElement> {
  nodes: CircuitNode[];
  connections: CircuitConnection[];
  width?: number;
  height?: number;
  gridSize?: number;
  showGrid?: boolean;
  gridColor?: string;
  traceColor?: string;
  pulseColor?: string;
  nodeColor?: string;
  pulseSpeed?: number;
  traceWidth?: number;
  variant?: 'light' | 'dark';
}

const NODE_PX: Record<CircuitNodeSize, number> = { sm: 24, md: 36, lg: 48 };

function CircuitBoard({
  nodes,
  connections,
  width = 600,
  height = 400,
  gridSize = 20,
  showGrid = true,
  gridColor,
  traceColor,
  pulseColor,
  nodeColor,
  pulseSpeed = 2,
  traceWidth = 2,
  variant = 'dark',
  style,
  ...props
}: CircuitBoardProps) {
  const reduceMotion = useReducedMotion();
  const uid = React.useId().replace(/:/g, '');
  const isDark = variant === 'dark';

  const computedGridColor = gridColor || (isDark ? 'rgba(163, 163, 163, 0.08)' : 'rgba(64, 64, 64, 0.12)');
  const computedTraceColor = traceColor || (isDark ? 'rgba(163, 163, 163, 0.25)' : 'rgba(106, 103, 114, 0.35)');
  const computedPulseColor = pulseColor || (isDark ? 'rgba(242, 153, 100, 0.85)' : 'rgba(242, 153, 100, 0.9)');
  const computedNodeColor = nodeColor || (isDark ? 'rgba(163, 163, 163, 0.5)' : 'rgba(106, 103, 114, 0.65)');

  const nodeMap = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const getNodeSize = React.useCallback((size?: CircuitNodeSize) => NODE_PX[size || 'md'], []);

  const calculatePath = React.useCallback(
    (from: CircuitNode, to: CircuitNode): string => {
      const fromSize = getNodeSize(from.size) / 2 + 4;
      const toSize = getNodeSize(to.size) / 2 + 4;
      const dx = to.x - from.x;
      const dy = to.y - from.y;

      let startX = from.x;
      let startY = from.y;
      let endX = to.x;
      let endY = to.y;

      if (Math.abs(dx) > Math.abs(dy)) {
        startX = from.x + (dx > 0 ? fromSize : -fromSize);
        endX = to.x + (dx > 0 ? -toSize : toSize);
        const midX = from.x + dx / 2;
        return `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`;
      }

      startY = from.y + (dy > 0 ? fromSize : -fromSize);
      endY = to.y + (dy > 0 ? -toSize : toSize);
      const midY = from.y + dy / 2;
      return `M ${startX} ${startY} V ${midY} H ${endX} V ${endY}`;
    },
    [getNodeSize],
  );

  const getStatusColor = (status?: CircuitNodeStatus) => {
    if (isDark) {
      switch (status) {
        case 'active':
          return 'rgba(242, 153, 100, 0.85)';
        case 'processing':
          return 'rgba(242, 153, 100, 0.7)';
        case 'error':
          return 'rgba(255, 111, 119, 0.75)';
        default:
          return computedNodeColor;
      }
    }
    switch (status) {
      case 'active':
        return 'rgba(224, 125, 66, 0.9)';
      case 'processing':
        return 'rgba(242, 153, 100, 0.85)';
      case 'error':
        return 'rgba(255, 111, 119, 0.85)';
      default:
        return computedNodeColor;
    }
  };

  const glowId = `circuit-glow-${uid}`;
  const gridId = `circuit-grid-${uid}`;

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        width,
        height,
        borderRadius: 8,
        border: isDark ? '1px solid var(--koala-border-strong)' : '1px solid var(--koala-border-primary)',
        fontFamily: 'var(--font-family-primary)',
        ...style,
      }}
      {...props}
    >
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        aria-hidden="true"
      >
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {showGrid && (
            <pattern id={gridId} width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
              <circle cx={gridSize / 2} cy={gridSize / 2} r="0.5" fill={computedGridColor} />
            </pattern>
          )}
        </defs>

        {showGrid && <rect width={width} height={height} fill={`url(#${gridId})`} />}

        {connections.map((conn, i) => {
          const fromNode = nodeMap.get(conn.from);
          const toNode = nodeMap.get(conn.to);
          if (!fromNode || !toNode) return null;

          const path = calculatePath(fromNode, toNode);
          const pathLength = 500;
          const stroke = conn.color || computedTraceColor;
          const pulse = conn.pulseColor || computedPulseColor;

          return (
            <g key={`${conn.from}-${conn.to}-${i}`}>
              <motion.path
                d={path}
                fill="none"
                stroke={stroke}
                strokeWidth={traceWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={reduceMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 1, delay: i * 0.15 }}
              />
              {conn.animated !== false && !reduceMotion && (
                <motion.path
                  d={path}
                  fill="none"
                  stroke={pulse}
                  strokeWidth={traceWidth + 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={`url(#${glowId})`}
                  strokeDasharray={`${pathLength * 0.1} ${pathLength * 0.9}`}
                  initial={{ strokeDashoffset: pathLength }}
                  animate={{ strokeDashoffset: -pathLength }}
                  transition={{
                    duration: pulseSpeed,
                    repeat: Infinity,
                    ease: 'linear',
                    delay: i * 0.25,
                  }}
                />
              )}
              {conn.bidirectional && !reduceMotion && (
                <motion.path
                  d={path}
                  fill="none"
                  stroke={pulse}
                  strokeWidth={traceWidth + 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={`url(#${glowId})`}
                  strokeDasharray={`${pathLength * 0.1} ${pathLength * 0.9}`}
                  initial={{ strokeDashoffset: -pathLength }}
                  animate={{ strokeDashoffset: pathLength }}
                  transition={{
                    duration: pulseSpeed,
                    repeat: Infinity,
                    ease: 'linear',
                    delay: i * 0.25 + pulseSpeed / 2,
                  }}
                />
              )}
            </g>
          );
        })}
      </svg>

      {nodes.map((node, i) => {
        const size = getNodeSize(node.size);
        const statusColor = getStatusColor(node.status);

        return (
          <motion.div
            key={node.id}
            style={{
              position: 'absolute',
              left: node.x - size / 2,
              top: node.y - size / 2,
              width: size,
              height: size,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduceMotion ? { duration: 0 } : { delay: i * 0.08 + 0.35, type: 'spring', stiffness: 260, damping: 20 }}
          >
            <motion.div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 8,
                backgroundColor: statusColor,
              }}
              animate={
                node.status === 'processing' && !reduceMotion
                  ? { opacity: [0.2, 0.5, 0.2] }
                  : { opacity: 0.2 }
              }
              transition={
                node.status === 'processing' && !reduceMotion
                  ? { duration: 1.5, repeat: Infinity }
                  : {}
              }
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 8,
                border: `2px solid ${statusColor}`,
                boxSizing: 'border-box',
              }}
            />
            {node.status === 'active' && !reduceMotion && (
              <motion.div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 8,
                  boxShadow: `0 0 16px ${statusColor}55, inset 0 0 8px ${statusColor}22`,
                }}
                animate={{ opacity: [0.45, 1, 0.45] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: statusColor,
              }}
            >
              {node.icon}
            </div>
            {node.label && (
              <div
                style={{
                  position: 'absolute',
                  bottom: -22,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '0.01em',
                  color: statusColor,
                  lineHeight: 1,
                }}
              >
                {node.label}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

export default CircuitBoard;
