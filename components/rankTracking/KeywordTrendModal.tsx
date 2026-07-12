import React from 'react';
import { Modal, ModalBody, Button } from '../core';
import type { RankHistorySummaryPoint } from '../../lib/types/rankTracking';

type Props = {
  open: boolean;
  keyword: string;
  points: RankHistorySummaryPoint[];
  onClose: () => void;
};

export default function KeywordTrendModal({ open, keyword, points, onClose }: Props) {
  if (!open) return null;
  const max = Math.max(...points.map((p) => p.position ?? 0), 20);

  return (
    <Modal title={keyword} onClose={onClose} width={560}>
      <ModalBody>
        {points.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: '#6A6772' }}>No position history yet. Run a rank check to collect data.</p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
              {points.slice(-30).map((p) => {
                const h = p.position && p.found ? Math.max(8, (1 - p.position / max) * 100) : 4;
                return (
                  <div
                    key={p.date}
                    title={`${p.date}: ${p.found ? p.position : 'Not ranking'}`}
                    style={{
                      flex: 1,
                      height: `${h}%`,
                      minWidth: 4,
                      borderRadius: 4,
                      background: p.found ? '#783AFB' : '#E4E4E7',
                    }}
                  />
                );
              })}
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 12, color: '#71717B' }}>
              Last {Math.min(30, points.length)} checks — lower bar means better position
            </p>
          </>
        )}
      </ModalBody>
      <div style={{ padding: '0 24px 24px', display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="button" variant="transparent" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
