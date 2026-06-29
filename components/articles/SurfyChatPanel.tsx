import React from 'react';
import SurfyMessage from './SurfyMessage';
import ContextUsageRing from './ContextUsageRing';
import IconSurfy from './IconSurfy';
import type { PendingAction } from '../../lib/ai/types';

export type SurfyHistoryEntry = { role: 'user' | 'assistant'; message: string; content?: string | null; action?: string };
export type SurfyActivity = { tool: string; done: boolean; error?: boolean };
export type SurfyResponseState = {
  action?: string; message: string; content: string | null;
  changelog?: Array<{ tool: string; summary: string }>; steps?: number; pendingAction?: PendingAction | null;
};

/** Everything the docked panel needs — the useSurfy hook returns exactly this shape. */
export interface SurfyPanelApi {
  history: SurfyHistoryEntry[];
  loading: boolean;
  activity: SurfyActivity[];
  streamText: string;
  response: SurfyResponseState | null;
  metaPending: string | null; // e.g. "title + description" | "title" | "description" | null
  prompt: string;
  publishing: boolean;
  canApply: boolean;
  canCompare: boolean;
  usage: { conversation: number; lastInput: number; lastOutput: number; totalInput: number; totalOutput: number };
  suggestions: string[];
  inputRef: React.RefObject<HTMLTextAreaElement>;
  scrollRef: React.RefObject<HTMLDivElement>;
  toolLabel: (t: string) => string;
  setPrompt: (v: string) => void;
  submit: () => void;
  stop: () => void;
  apply: () => void;
  openCompare: () => void;
  dismiss: () => void;
  newConversation: () => void;
  confirmPublish: () => void;
  cancelPublish: () => void;
  pickSuggestion: (s: string) => void;
  close: () => void;
}

const HeaderBtn = ({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) => (
  <button
    type="button" onClick={onClick} aria-label={label} title={label}
    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'transparent', border: 'none', color: '#52525c', cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'background 150ms ease, color 150ms ease' }}
    onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f4f5'; e.currentTarget.style.color = '#18181b'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#52525c'; }}
  >
    {children}
  </button>
);

/** Docked, light, Twenty-style Surfy chat pane for the editor's right column. Pure view — all
 *  state + behaviour come from `s` (the useSurfy hook). */
const SurfyChatPanel = ({ s }: { s: SurfyPanelApi }) => {
  const { response, loading } = s;
  const empty = s.history.length === 0 && !loading && !response;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: '#fff', fontFamily: 'var(--font-family-primary)' }}>
      <style>{'@keyframes surfyspin { to { transform: rotate(360deg); } }'}</style>

      {/* Header — 48px, Twenty-style */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, height: 48, padding: '0 8px 0 14px', borderBottom: '1px solid #f4f4f5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <IconSurfy size={18} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>Surfy</span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#9f9fa9', background: '#f4f4f5', border: '1px solid #ececef', padding: '1px 6px', borderRadius: 9999 }}>alpha</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ContextUsageRing
            conversationTokens={s.usage.conversation}
            lastInput={s.usage.lastInput} lastOutput={s.usage.lastOutput}
            totalInput={s.usage.totalInput} totalOutput={s.usage.totalOutput}
          />
          <HeaderBtn onClick={s.newConversation} label="New conversation">
            <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" /><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415" /><path d="M16 5l3 3" /></svg>
          </HeaderBtn>
          <HeaderBtn onClick={s.close} label="Close">
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </HeaderBtn>
        </div>
      </div>

      {/* Conversation body — scrolls; header + composer stay pinned */}
      <div ref={s.scrollRef} className="styled-scrollbar" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {empty && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#18181b' }}>What can I help you with?</div>
          </div>
        )}

        {s.history.map((entry, i) => (
          <SurfyMessage key={i} role={entry.role} message={entry.message} />
        ))}

        {/* Loading / live stream */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 15, height: 15, border: '2px solid #e4e4e7', borderTopColor: '#783afb', borderRadius: '50%', display: 'inline-block', animation: 'surfyspin 0.6s linear infinite' }} />
                <span style={{ fontSize: 13, color: '#52525c' }}>Surfy is working…</span>
              </div>
              <button type="button" onClick={s.stop}
                style={{ padding: '4px 10px', borderRadius: 6, background: '#f4f4f5', border: '1px solid #ececef', cursor: 'pointer', color: '#52525c', fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}>
                Stop
              </button>
            </div>
            {s.activity.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {s.activity.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, lineHeight: '18px', color: a.error ? '#d97706' : a.done ? '#52525c' : '#9f9fa9' }}>
                    <span style={{ flexShrink: 0, width: 13, textAlign: 'center' }}>
                      {a.error ? '⚠' : a.done ? '✓' : <span style={{ display: 'inline-block', width: 9, height: 9, border: '1.5px solid #d4d4d8', borderTopColor: '#783afb', borderRadius: '50%', animation: 'surfyspin 0.6s linear infinite' }} />}
                    </span>
                    <span>{s.toolLabel(a.tool)}</span>
                  </div>
                ))}
              </div>
            )}
            {s.streamText && (
              <div style={{ fontSize: 14, lineHeight: 1.5, color: '#18181b', whiteSpace: 'pre-wrap' }}>{s.streamText}</div>
            )}
          </div>
        )}

        {/* What Surfy did */}
        {response && !loading && ((response.changelog?.length ?? 0) > 0 || Boolean(s.metaPending)) && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: '#9f9fa9', marginBottom: 5 }}>
              WHAT SURFY DID{typeof response.steps === 'number' ? ` · ${response.steps} steps` : ''}
            </div>
            {(response.changelog || []).map((c, i) => {
              const guard = c.tool === 'guard';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12.5, lineHeight: '18px', color: guard ? '#d97706' : '#52525c' }}>
                  <span style={{ flexShrink: 0 }}>{guard ? '⚠' : '✓'}</span>
                  <span>{c.summary}</span>
                </div>
              );
            })}
            {s.metaPending && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '2px 8px', borderRadius: 9999, background: 'rgba(120,58,251,0.1)', color: '#783afb', fontSize: 11, fontWeight: 500 }}>
                ✎ Will update meta {s.metaPending}
              </div>
            )}
          </div>
        )}

        {/* Publish proposal */}
        {response && !loading && response.pendingAction?.type === 'publish_to_wordpress' && (
          <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f8f9ff', border: '1px solid #e4e4e7' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#783afb" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 16V4" /><path d="m6 10 6-6 6 6" /><path d="M4 20h16" /></svg>
              <div style={{ fontSize: 12.5, lineHeight: '18px', color: '#52525c' }}>
                Surfy chce opublikować {response.pendingAction.title ? `„${response.pendingAction.title}” ` : ''}do WordPressa. Publikowany jest <strong style={{ fontWeight: 600, color: '#18181b' }}>zapisany</strong> artykuł.
              </div>
            </div>
            {response.pendingAction.warning && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11.5, lineHeight: '17px', color: '#d97706' }}>
                <span style={{ flexShrink: 0 }}>⚠</span><span>{response.pendingAction.warning}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              <button type="button" onClick={s.cancelPublish} disabled={s.publishing}
                style={{ padding: '6px 12px', borderRadius: 6, background: 'transparent', border: 'none', cursor: s.publishing ? 'default' : 'pointer', color: '#52525c', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}>
                Anuluj
              </button>
              <button type="button" onClick={s.confirmPublish} disabled={s.publishing}
                style={{ padding: '6px 14px', borderRadius: 6, background: '#783afb', border: 'none', cursor: s.publishing ? 'default' : 'pointer', opacity: s.publishing ? 0.65 : 1, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-family-primary)' }}>
                {s.publishing ? 'Publikuję…' : 'Publikuj'}
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {response && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 8, borderTop: '1px solid #f4f4f5' }}>
            <button type="button" onClick={s.dismiss}
              style={{ padding: '6px 12px', borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#52525c', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}>
              Dismiss
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {s.canCompare && (
                <button type="button" onClick={s.openCompare}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: '#f4f4f5', border: '1px solid #ececef', cursor: 'pointer', color: '#18181b', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}>
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx={12} cy={12} r={3} /></svg>
                  See changes
                </button>
              )}
              {s.canApply && (
                <button type="button" onClick={s.apply}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, background: '#783afb', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-family-primary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#5a1fd6'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#783afb'; }}>
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                  Apply changes
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div style={{ flexShrink: 0, borderTop: '1px solid #f4f4f5', padding: 8 }}>
        {empty && s.suggestions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 2px 8px' }}>
            {s.suggestions.map((sug) => (
              <button key={sug} type="button" onClick={() => s.pickSuggestion(sug)}
                style={{ padding: '4px 10px', borderRadius: 9999, background: '#f4f4f5', border: '1px solid #ececef', color: '#52525c', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-family-primary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#ececef'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#f4f4f5'; }}>
                {sug}
              </button>
            ))}
          </div>
        )}
        <div className="surfy-composer" style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 8px 8px 12px', border: '1px solid #d4d4d8', borderRadius: 12, background: '#fff', transition: 'border-color 150ms ease, box-shadow 150ms ease' }}>
          <textarea
            ref={s.inputRef}
            rows={1}
            value={s.prompt}
            onChange={(e) => s.setPrompt(e.target.value)}
            onFocus={(e) => { const p = e.currentTarget.parentElement; if (p) { p.style.borderColor = '#AA93FD'; p.style.boxShadow = '0 0 0 3px rgba(120,58,251,0.1)'; } }}
            onBlur={(e) => { const p = e.currentTarget.parentElement; if (p) { p.style.borderColor = '#d4d4d8'; p.style.boxShadow = 'none'; } }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); s.submit(); } }}
            placeholder="Ask, search or create anything…"
            disabled={loading}
            className="styled-scrollbar"
            style={{ flex: 1, minHeight: 24, maxHeight: 200, border: 'none', borderRadius: 0, background: 'transparent', outline: 'none', padding: '0 0 2px', fontSize: 14, lineHeight: '24px', color: '#18181b', fontFamily: 'var(--font-family-primary)', resize: 'none', overflowY: 'auto' }}
          />
          <button
            type="button" onClick={s.submit} disabled={!s.prompt.trim() || loading} aria-label="Send"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 9999, background: s.prompt.trim() && !loading ? '#783afb' : '#f4f4f5', border: 'none', color: s.prompt.trim() && !loading ? '#fff' : '#9f9fa9', cursor: s.prompt.trim() && !loading ? 'pointer' : 'not-allowed', padding: 0, flexShrink: 0, transition: 'background 150ms ease' }}
          >
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
          </button>
        </div>
        <div style={{ padding: '7px 2px 0', color: '#9f9fa9', fontSize: 10.5, lineHeight: '14px' }}>
          Surfy can make mistakes — review changes before applying.
        </div>
      </div>
    </div>
  );
};

export default SurfyChatPanel;
