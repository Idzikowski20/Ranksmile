import React, { useEffect, useState } from 'react';
import ScoreGauge from './ScoreGauge';

interface Version {
  id: number;
  article_id: number;
  version_type: string;
  content_length: number;
  created_at: string;
  score: number | null;
}

interface Props {
  articleId: number;
  currentWordCount: number;
  currentScore: number;
  onClose: () => void;
  onRestore: (version: { id: number; content: string; score_data: string | null }) => void;
}

const versionTypeLabel = (type: string): string => {
  switch (type) {
    case 'manual_save': return 'Manual save';
    case 'pre_auto_optimize': return 'Before auto-optimize';
    case 'auto_optimize': return 'Auto-optimized';
    case 'pre_restore': return 'Before restore';
    default: return type;
  }
};

const formatTime = (iso: string): { date: string; relative: string } => {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffH / 24);

  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  let relative: string;
  if (diffH < 1) relative = 'less than an hour ago';
  else if (diffH < 24) relative = `${diffH} hour${diffH > 1 ? 's' : ''} ago`;
  else relative = `${diffD} day${diffD > 1 ? 's' : ''} ago`;

  return { date: dateStr, relative };
};

const VersionHistoryPanel = ({ articleId, currentScore, onClose, onRestore }: Props) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/articles/${articleId}/versions`)
      .then((r) => r.json())
      .then((data) => setVersions(data.versions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [articleId]);

  const handleRestore = async (versionId: number) => {
    setRestoringId(versionId);
    try {
      const res = await fetch(`/api/articles/${articleId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restore failed');
      onRestore({ id: versionId, content: data.content, score_data: data.score_data });
    } catch {
      // silently fail — parent handles toast
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Top section ─────────────────────────────────── */}
      <div
        style={{
          background: '#fff',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          borderRadius: 12,
          flexShrink: 0,
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, lineHeight: '1.25rem', fontWeight: 600, fontFamily: 'var(--font-family-primary)', color: '#18181B' }}>
            Version History
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'inherit', padding: 0, borderRadius: 0,
              fontFamily: 'var(--font-family-primary)',
            }}
          >
            <svg viewBox="0 0 24 24" width={20} height={20} style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'sub' }}>
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

      </div>

      {/* ── Bottom section: version list ────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
        }}
        className="styled-scrollbar"
      >
        {/* Current version card */}
        <div
          style={{
            background: '#fff',
            padding: 12,
            marginBottom: 12,
            cursor: 'pointer',
            borderRadius: 8,
            border: '1px solid #18181B',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', borderBottom: '1px solid #E4E4E7', paddingBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, height: 28, alignItems: 'center' }}>
                <svg viewBox="0 0 20 20" width={16} height={16} style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'sub', color: '#360483' }}>
                  <path fill="currentColor" d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572z" />
                </svg>
                <span style={{ fontSize: 14, fontFamily: 'var(--font-family-primary)', color: '#18181B' }}>Current Version</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, lineHeight: '1.25rem', fontFamily: 'var(--font-family-primary)', color: '#18181B' }}>You</div>
              <div className="vh-ring" style={{ flexShrink: 0, display: 'flex' }}><ScoreGauge score={currentScore} size={52} /></div>
            </div>
          </div>
        </div>

        {/* Past versions */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <div style={{ width: 20, height: 20, border: '2px solid #E4E4E7', borderTopColor: '#F29964', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          </div>
        ) : versions.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 0' }}>
            <span style={{ fontSize: 14, fontFamily: 'var(--font-family-primary)', color: '#52525C', textAlign: 'center', fontWeight: 600 }}>
              No version history yet
            </span>
            <span style={{ fontSize: 14, fontFamily: 'var(--font-family-primary)', color: '#52525C', textAlign: 'center' }}>
              Saved versions will appear here.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {versions.map((v) => {
              const { date, relative } = formatTime(v.created_at);
              return (
                <div
                  key={v.id}
                  className="version-row"
                  style={{
                    background: '#fff',
                    padding: 12,
                    marginBottom: 12,
                    border: '1px solid #E4E4E7',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', borderBottom: '1px solid #E4E4E7', paddingBottom: 12 }}>
                      <div style={{ display: 'flex', height: 28, width: '100%', alignItems: 'center' }}>
                        <span style={{ textAlign: 'left', fontSize: 14, lineHeight: '1.25rem', fontFamily: 'var(--font-family-primary)', color: '#18181B' }}>
                          <span>{date}</span>
                          <span style={{ fontWeight: 400, color: '#52525C' }}> ({relative})</span>
                        </span>
                      </div>
                      <div className="version-restore-btn" style={{ opacity: 0, transition: 'opacity 0.15s' }}>
                        <button
                          type="button"
                          disabled={restoringId === v.id}
                          onClick={() => handleRestore(v.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            fontFamily: 'var(--font-family-primary)',
                            fontWeight: 600,
                            transition: 'color 0.15s, background-color 0.15s, box-shadow 0.15s, opacity 0.15s',
                            padding: '4px 12px',
                            borderRadius: 6,
                            fontSize: 13,
                            lineHeight: '1rem',
                            background: '#F4F4F5',
                            color: '#18181B',
                            cursor: restoringId === v.id ? 'not-allowed' : 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={(e) => { if (restoringId !== v.id) { e.currentTarget.style.background = '#E4E4E7'; } }}
                          onMouseLeave={(e) => { if (restoringId !== v.id) { e.currentTarget.style.background = '#F4F4F5'; } }}
                          onMouseDown={(e) => { if (restoringId !== v.id) { e.currentTarget.style.background = '#D4D4D8'; } }}
                        >
                          {restoringId === v.id ? 'Restoring…' : 'Restore'}
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 6, paddingBottom: 6 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, lineHeight: '1rem', fontFamily: 'var(--font-family-primary)', color: '#18181B' }}>
                        {versionTypeLabel(v.version_type)}
                      </span>
                      {v.score != null && (
                        <div className="vh-ring" style={{ flexShrink: 0, display: 'flex' }}><ScoreGauge score={v.score} size={52} /></div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CSS for group-hover effect on version rows */}
      <style>{`
        .version-row:hover .version-restore-btn { opacity: 1 !important; }
      `}</style>
    </div>
  );
};

export default VersionHistoryPanel;
