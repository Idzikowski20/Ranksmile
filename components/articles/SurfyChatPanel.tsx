import React, { useState, useEffect, useCallback, useRef } from 'react';
import SurfyMessage from './SurfyMessage';
import ContextUsageRing from './ContextUsageRing';
import IconSurfy from './IconSurfy';
import type { PendingAction } from '../../lib/ai/types';

export type SurfyHistoryEntry = { role: 'user' | 'assistant'; message: string; content?: string | null; action?: string; thinking?: string };
export type SurfyActivity = { tool: string; done: boolean; error?: boolean };
export type SurfyConversation = { id: string; title: string; ts: number };
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
  metaPending: string | null;
  prompt: string;
  publishing: boolean;
  canApply: boolean;
  canCompare: boolean;
  usage: { conversation: number; lastInput: number; lastOutput: number; totalInput: number; totalOutput: number };
  /** Organization's shared 5h AI-token pool (drives the ring + the blocked banner). Null until loaded. */
  orgUsage: { used: number; limit: number; resetsAt: number; over: boolean } | null;
  suggestions: string[];
  conversations: SurfyConversation[];
  /** Text the user had selected when they opened Surfy — shown as a context chip (null = none). */
  selectionText: string | null;
  clearSelection: () => void;
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
  openConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  confirmPublish: () => void;
  cancelPublish: () => void;
  pickSuggestion: (s: string) => void;
  close: () => void;
}

const HeaderBtn = ({ onClick, label, active, children }: { onClick: () => void; label: string; active?: boolean; children: React.ReactNode }) => (
  <button
    type="button" onClick={onClick} aria-label={label} title={label}
    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: active ? '#f4f4f5' : 'transparent', border: 'none', color: active ? '#18181b' : '#52525c', cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'background 150ms ease, color 150ms ease' }}
    onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f4f5'; e.currentTarget.style.color = '#18181b'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = active ? '#f4f4f5' : 'transparent'; e.currentTarget.style.color = active ? '#18181b' : '#52525c'; }}
  >
    {children}
  </button>
);

const relTime = (ts: number) => {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

/** Full-panel conversation picker (replaces the chat view when the history icon is active). */
const HistoryView = ({ s, onBack, onPick, onNew }: { s: SurfyPanelApi; onBack: () => void; onPick: (id: string) => void; onNew: () => void }) => {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuId) return undefined;
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuId]);
  const commitRename = () => { if (editingId) s.renameConversation(editingId, editTitle); setEditingId(null); };

  return (
  <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
    <style>{'.surfy-convo-row:hover { background: #f4f4f5 !important; } .surfy-convo-row:hover .surfy-kebab { opacity: 1 !important; } .surfy-cta:active { transform: scale(0.98); }'}</style>
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 8px 0 6px', borderBottom: '1px solid #f4f4f5' }}>
      <HeaderBtn onClick={onBack} label="Back to chat">
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </HeaderBtn>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>Conversations</span>
    </div>

    {s.conversations.length === 0 ? (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '24px 28px 40px', textAlign: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 16, background: 'rgba(120,58,251,0.08)', color: '#783afb' }}>
          <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" /></svg>
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#18181b' }}>No conversations yet</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: '#52525c', maxWidth: 240 }}>Your chats with Surfy are saved here. Start one to optimise this article.</div>
        </div>
        <button
          type="button" className="surfy-cta" onClick={onNew}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 2, padding: '9px 16px', borderRadius: 10, background: '#783afb', border: 'none', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-family-primary)', transition: 'background 150ms ease, transform 80ms ease', boxShadow: '0 1px 2px rgba(120,58,251,0.35)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#5a1fd6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#783afb'; }}
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Start a new conversation
        </button>
      </div>
    ) : (
      <div className="styled-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}>
        {s.conversations.map((c) => {
          const editing = editingId === c.id;
          return (
          <div
            key={c.id} className="surfy-convo-row" role="button" tabIndex={0}
            onClick={() => { if (!editing) onPick(c.id); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !editing) onPick(c.id); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 10px', borderRadius: 10, cursor: editing ? 'default' : 'pointer', transition: 'background 150ms ease' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: '#f4f4f5', color: '#52525c', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" /></svg>
            </span>
            {editing ? (
              <input
                value={editTitle} autoFocus
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                onBlur={commitRename}
                style={{ flex: 1, minWidth: 0, border: '1px solid #AA93FD', borderRadius: 7, padding: '5px 8px', fontSize: 13.5, color: '#18181b', outline: 'none', boxShadow: '0 0 0 3px rgba(120,58,251,0.1)', fontFamily: 'var(--font-family-primary)' }}
              />
            ) : (
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 13.5, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || 'Conversation'}</span>
                <span style={{ fontSize: 11.5, color: '#9f9fa9' }}>{relTime(c.ts)}</span>
              </div>
            )}
            {!editing && (
              <div ref={menuId === c.id ? menuRef : undefined} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  type="button" aria-label="Conversation options" className="surfy-kebab"
                  onClick={(e) => { e.stopPropagation(); setMenuId(menuId === c.id ? null : c.id); }}
                  style={{ opacity: menuId === c.id ? 1 : 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: menuId === c.id ? '#ececef' : 'transparent', border: 'none', color: '#52525c', cursor: 'pointer', transition: 'opacity 150ms ease, background 150ms ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#ececef'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = menuId === c.id ? '#ececef' : 'transparent'; }}>
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true"><circle cx={12} cy={5} r={1.6} /><circle cx={12} cy={12} r={1.6} /><circle cx={12} cy={19} r={1.6} /></svg>
                </button>
                {menuId === c.id && (
                  <div onClick={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 60, width: 168, background: '#fff', border: '1px solid #e4e4e7', borderRadius: 10, padding: 5, boxShadow: '0px 8px 24px rgba(24,26,34,0.16), 0px 2px 6px rgba(24,26,34,0.08)', animation: 'growOut 0.16s cubic-bezier(0.16,1,0.3,1)' }}>
                    <button type="button" onClick={() => { setEditingId(c.id); setEditTitle(c.title || ''); setMenuId(null); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 8px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: '#18181b', fontSize: 13, fontFamily: 'var(--font-family-primary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f4f5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                      <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                      Rename
                    </button>
                    <button type="button" onClick={() => { s.deleteConversation(c.id); setMenuId(null); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 8px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', fontSize: 13, fontFamily: 'var(--font-family-primary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                      <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-9 0v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6" /></svg>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>
    )}
  </div>
  );
};

/** Docked, light, Twenty-style Surfy chat pane for the editor's right column. Pure view — all
 *  state + behaviour come from `s` (the useSurfy hook). */
const SurfyChatPanel = ({ s }: { s: SurfyPanelApi }) => {
  const { response, loading } = s;
  const blocked = Boolean(s.orgUsage?.over); // org spent its shared 5h budget → composer is locked
  const empty = s.history.length === 0 && !loading && !response;
  const [helpOpen, setHelpOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [atBottom, setAtBottom] = useState(true);
  const [liveThinkOpen, setLiveThinkOpen] = useState(false);

  const onScroll = () => {
    const el = s.scrollRef.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
  };
  const scrollToBottom = useCallback((smooth = true) => {
    const el = s.scrollRef.current;
    if (el) { el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); setAtBottom(true); }
  }, [s.scrollRef]);
  // Stick to the bottom as the conversation grows/streams — but only if the user is already there
  // (so reading older messages isn't yanked away; the ↓ button appears instead).
  useEffect(() => {
    if (atBottom) { const el = s.scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.history, s.streamText, s.activity, s.loading, s.response]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: '#fff', fontFamily: 'var(--font-family-primary)' }}>
      <style>{`
        @keyframes surfyspin { to { transform: rotate(360deg); } }
        .surfy-box:focus-within { border-color: #AA93FD !important; box-shadow: 0 0 0 3px rgba(120,58,251,0.1) !important; }
      `}</style>

      {/* Header — 48px, Twenty-style */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, height: 48, padding: '0 8px 0 14px', borderBottom: '1px solid #f4f4f5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <IconSurfy size={18} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>Surfy</span>
          <span
            style={{ position: 'relative', display: 'inline-flex' }}
            onMouseEnter={() => setHelpOpen(true)} onMouseLeave={() => setHelpOpen(false)}
          >
            <span aria-label="About Surfy" style={{ display: 'inline-flex', color: '#9f9fa9', cursor: 'help' }}>
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx={12} cy={12} r={10} /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
            </span>
            {helpOpen && (
              <span style={{ position: 'absolute', top: 'calc(100% + 6px)', left: -2, zIndex: 250, width: 210, background: '#18181b', color: '#fff', fontSize: 11.5, lineHeight: '16px', padding: '8px 10px', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
                <strong style={{ fontWeight: 600 }}>Pre alpha</strong> — Surfy can make mistakes; review changes before applying.
              </span>
            )}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <HeaderBtn onClick={() => setView((v) => (v === 'history' ? 'chat' : 'history'))} label="Conversation history" active={view === 'history'}>
            <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-7 3.3" /><path d="M3 4v3h3" /><path d="M12 7v5l3 2" /></svg>
          </HeaderBtn>
          <HeaderBtn onClick={() => { s.newConversation(); setView('chat'); }} label="New conversation">
            <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" /><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415" /><path d="M16 5l3 3" /></svg>
          </HeaderBtn>
          <HeaderBtn onClick={s.close} label="Close">
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </HeaderBtn>
        </div>
      </div>

      {view === 'history' ? (
        <HistoryView
          s={s}
          onBack={() => setView('chat')}
          onPick={(id) => { s.openConversation(id); setView('chat'); }}
          onNew={() => { s.newConversation(); setView('chat'); }}
        />
      ) : (
        <>
          {/* Conversation body — relative wrapper so the scroll-to-latest ↓ can float over it */}
          <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div ref={s.scrollRef} onScroll={onScroll} className="styled-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {empty && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#18181b' }}>What can I help you with?</div>
              </div>
            )}

            {s.history.map((entry, i) => (
              <SurfyMessage key={i} role={entry.role} message={entry.message} thinking={entry.thinking} />
            ))}

            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 15, height: 15, border: '2px solid #e4e4e7', borderTopColor: '#783afb', borderRadius: '50%', display: 'inline-block', animation: 'surfyspin 0.6s linear infinite' }} />
                  <span style={{ fontSize: 13, color: '#52525c' }}>Surfy is working…</span>
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
                  <div>
                    <button type="button" onClick={() => setLiveThinkOpen((o) => !o)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 4px', margin: '-2px -4px', borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#9f9fa9', fontSize: 12.5, fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#52525c'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#9f9fa9'; }}>
                      <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: liveThinkOpen ? 'rotate(90deg)' : 'none', transition: 'transform 150ms ease' }}><path d="M9 18l6-6-6-6" /></svg>
                      Thinking…
                    </button>
                    {liveThinkOpen && (
                      <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid #f0f0f2', color: '#9f9fa9', fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{s.streamText}</div>
                    )}
                  </div>
                )}
              </div>
            )}

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

            {/* Action row only when Surfy actually staged something to apply/review — pure advice
                gets no Dismiss (there's nothing to dismiss; the reply stays in the conversation). */}
            {response && !loading && (s.canApply || s.canCompare) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid #f4f4f5' }}>
                {/* Two equal-width actions on one row (no text wrap), Dismiss as a quiet link below. */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {s.canCompare && (
                    <button type="button" onClick={s.openCompare}
                      style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, background: '#f4f4f5', border: '1px solid #ececef', cursor: 'pointer', color: '#18181b', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', fontFamily: 'var(--font-family-primary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#ececef'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#f4f4f5'; }}>
                      <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx={12} cy={12} r={3} /></svg>
                      See changes
                    </button>
                  )}
                  {s.canApply && (
                    <button type="button" onClick={s.apply}
                      style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, background: '#783afb', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'var(--font-family-primary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#5a1fd6'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#783afb'; }}>
                      <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                      Apply changes
                    </button>
                  )}
                </div>
                <button type="button" onClick={s.dismiss}
                  style={{ alignSelf: 'center', padding: '2px 8px', borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#9f9fa9', fontSize: 12.5, fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#52525c'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#9f9fa9'; }}>
                  Dismiss
                </button>
              </div>
            )}
          </div>
            {!atBottom && (
              <button type="button" onClick={() => scrollToBottom()} aria-label="Scroll to latest"
                style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 5, width: 30, height: 30, borderRadius: 9999, background: '#fff', border: '1px solid #e4e4e7', boxShadow: '0 4px 14px rgba(24,26,34,0.14)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#52525c', cursor: 'pointer', transition: 'background 150ms ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f4f5'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}>
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
              </button>
            )}
          </div>

          {/* Composer — Twenty-style box: textarea on top, controls + context ring inside the bottom row */}
          <div style={{ flexShrink: 0, padding: 10 }}>
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
            {/* Selected-text context chip — sits directly above the input box */}
            {s.selectionText && (
              <div title={s.selectionText} style={{ display: 'flex', alignItems: 'center', gap: 6, width: 'fit-content', maxWidth: '100%', padding: '3px 5px 3px 9px', marginBottom: 8, borderRadius: 8, background: '#f4f4f5', border: '1px solid #e4e4e7' }}>
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="#9f9fa9" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true"><path d="M7 8h10M7 12h6M5 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 4V5a1 1 0 0 1 1-1Z" /></svg>
                <span style={{ fontSize: 12, color: '#3f3f47', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{s.selectionText}</span>
                <button type="button" onClick={s.clearSelection} aria-label="Clear selected text"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 6, background: 'transparent', border: 'none', color: '#9f9fa9', cursor: 'pointer', flexShrink: 0, transition: 'background 150ms ease, color 150ms ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#e4e4e7'; e.currentTarget.style.color = '#52525c'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9f9fa9'; }}>
                  <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}
            {/* Org-wide budget exhausted: the whole organization shares one 5h pool. */}
            {blocked && s.orgUsage && (
              <div style={{ display: 'flex', gap: 9, padding: '10px 12px', marginBottom: 8, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca' }}>
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#dc2626" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
                <div style={{ fontSize: 12.5, lineHeight: '18px', color: '#7f1d1d' }}>
                  <span style={{ fontWeight: 600 }}>Your organization reached its AI limit.</span>{' '}
                  The shared budget resets every 5 hours — try again at{' '}
                  <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{new Date(s.orgUsage.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>.
                </div>
              </div>
            )}
            <div className="surfy-box" style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 116, padding: 12, border: '1px solid #d4d4d8', borderRadius: 12, background: blocked ? '#fafafa' : '#fff', opacity: blocked ? 0.7 : 1, transition: 'border-color 150ms ease, box-shadow 150ms ease' }}>
              <textarea
                ref={s.inputRef}
                rows={1}
                value={s.prompt}
                onChange={(e) => s.setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!blocked) s.submit(); } }}
                placeholder={blocked ? 'AI limit reached — paused until the pool resets' : 'Ask, search or make anything…'}
                disabled={loading || blocked}
                className="styled-scrollbar"
                style={{ flex: 1, minHeight: 48, maxHeight: 280, border: 'none', background: 'transparent', outline: 'none', padding: 0, fontSize: 14, lineHeight: '20px', color: '#18181b', fontFamily: 'var(--font-family-primary)', resize: 'none', overflowY: 'auto' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <ContextUsageRing
                  placement="up"
                  conversationTokens={s.orgUsage ? s.orgUsage.used : s.usage.conversation}
                  contextWindow={s.orgUsage ? s.orgUsage.limit : undefined}
                  resetsAt={s.orgUsage ? s.orgUsage.resetsAt : undefined}
                  lastInput={s.usage.lastInput} lastOutput={s.usage.lastOutput}
                  totalInput={s.usage.totalInput} totalOutput={s.usage.totalOutput}
                />
                {/* While Surfy works this becomes a Stop button (Claude-style square); otherwise Send. */}
                <button
                  type="button"
                  onClick={loading ? s.stop : s.submit}
                  disabled={loading ? false : (blocked || !s.prompt.trim())}
                  aria-label={loading ? 'Stop' : 'Send'}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 9999, background: loading ? '#18181b' : (!blocked && s.prompt.trim()) ? '#783afb' : '#f4f4f5', border: 'none', color: loading || (!blocked && s.prompt.trim()) ? '#fff' : '#9f9fa9', cursor: loading || (!blocked && s.prompt.trim()) ? 'pointer' : 'not-allowed', padding: 0, flexShrink: 0, transition: 'background 150ms ease' }}
                >
                  {loading
                    ? <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true"><rect x={7.5} y={7.5} width={9} height={9} rx={2} fill="currentColor" /></svg>
                    : <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SurfyChatPanel;
