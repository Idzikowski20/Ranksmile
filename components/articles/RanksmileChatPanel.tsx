import React, { useState, useEffect, useCallback, useRef } from 'react';
import RanksmileMessage from './RanksmileMessage';
import ContextUsageRing from './ContextUsageRing';
import IconRanksmile from './IconRanksmile';
import AILoadingState from './AILoadingState';
import RanksmileStreamingMessage from './RanksmileStreamingMessage';
import { AIVoiceButton, AIVoicePanel, useAIVoice } from './AIVoice';
import { Button, Chip } from '../koala/core';
import { Icon } from '../koala/icons/Icon';
import { KoalaEmptyState } from '../koala/layout';
import { useProfile } from '../../services/profile';
import { authClient } from '../../lib/auth/client';
import type { PendingAction } from '../../lib/ai/types';
import { shouldShowRanksmileAnswerStream } from '../../lib/ai/text';

/** Figma AiChatInput message length (node 11595:412570). */
const PROMPT_CHAR_LIMIT = 2200;

export type RanksmileHistoryEntry = { role: 'user' | 'assistant'; message: string; content?: string | null; action?: string; thinking?: string };
export type RanksmileActivity = { tool: string; done: boolean; error?: boolean };
export type RanksmileConversation = { id: string; title: string; ts: number };
export type RanksmileResponseState = {
  action?: string; message: string; content: string | null;
  changelog?: Array<{ tool: string; summary: string }>; steps?: number; pendingAction?: PendingAction | null;
};

/** Everything the docked panel needs � the useRanksmile hook returns exactly this shape. */
export interface RanksmilePanelApi {
  history: RanksmileHistoryEntry[];
  loading: boolean;
  activity: RanksmileActivity[];
  streamText: string;
  /** Byte/char offset in streamText where between-tool narration ends (0 = all answer so far). */
  streamThinkingLen: number;
  response: RanksmileResponseState | null;
  metaPending: string | null;
  prompt: string;
  publishing: boolean;
  canApply: boolean;
  canCompare: boolean;
  usage: { conversation: number; lastInput: number; lastOutput: number; totalInput: number; totalOutput: number };
  /** Organization's shared 5h AI-token pool (drives the ring + the blocked banner). Null until loaded. */
  orgUsage: { used: number; limit: number; resetsAt: number; over: boolean } | null;
  suggestions: string[];
  conversations: RanksmileConversation[];
  /** Text the user had selected when they opened Ranksmile � shown as a context chip (null = none). */
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
    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: active ? '#FFF0EB' : 'transparent', border: 'none', color: active ? 'var(--koala-text-brand)' : 'var(--koala-text-secondary)', cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'background 150ms ease, color 150ms ease' }}
    onMouseEnter={(e) => { e.currentTarget.style.background = active ? '#FFF0EB' : '#f5f5f5'; e.currentTarget.style.color = active ? 'var(--koala-text-brand)' : 'var(--koala-text-primary)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = active ? '#FFF0EB' : 'transparent'; e.currentTarget.style.color = active ? 'var(--koala-text-brand)' : 'var(--koala-text-secondary)'; }}
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
const HistoryView = ({ s, onBack, onPick, onNew }: { s: RanksmilePanelApi; onBack: () => void; onPick: (id: string) => void; onNew: () => void }) => {
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
    <style>{'.ranksmile-convo-row:hover { background: #f5f5f5 !important; } .ranksmile-convo-row:hover .ranksmile-kebab { opacity: 1 !important; }'}</style>
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 8px 0 6px', borderBottom: '1px solid var(--koala-border-primary)' }}>
      <HeaderBtn onClick={onBack} label="Back to chat">
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </HeaderBtn>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--koala-text-primary)' }}>Conversations</span>
    </div>

    {s.conversations.length === 0 ? (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 12px 32px' }}>
        <KoalaEmptyState
          title="No conversations yet"
          description="Your chats with Smily are saved here. Start one to optimise this article."
          actions={(
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onNew}
              icon={(
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              )}
            >
              Start a new conversation
            </Button>
          )}
        />
      </div>
    ) : (
      <div className="styled-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}>
        {s.conversations.map((c) => {
          const editing = editingId === c.id;
          return (
          <div
            key={c.id} className="ranksmile-convo-row" role="button" tabIndex={0}
            onClick={() => { if (!editing) onPick(c.id); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !editing) onPick(c.id); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 10px', borderRadius: 10, cursor: editing ? 'default' : 'pointer', transition: 'background 150ms ease' }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: '#f5f5f5', color: 'var(--koala-text-secondary)', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" /></svg>
            </span>
            {editing ? (
              <input
                value={editTitle} autoFocus
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                onBlur={commitRename}
                style={{ flex: 1, minWidth: 0, border: '1px solid var(--koala-text-brand)', borderRadius: 8, padding: '5px 8px', fontSize: 13.5, color: 'var(--koala-text-primary)', outline: 'none', boxShadow: '0 0 0 3px rgba(248,68,22,0.12)', fontFamily: 'var(--font-family-primary)' }}
              />
            ) : (
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 13.5, color: 'var(--koala-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || 'Conversation'}</span>
                <span style={{ fontSize: 11.5, color: 'var(--koala-text-disabled)' }}>{relTime(c.ts)}</span>
              </div>
            )}
            {!editing && (
              <div ref={menuId === c.id ? menuRef : undefined} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  type="button" aria-label="Conversation options" className="ranksmile-kebab"
                  onClick={(e) => { e.stopPropagation(); setMenuId(menuId === c.id ? null : c.id); }}
                  style={{ opacity: menuId === c.id ? 1 : 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: menuId === c.id ? 'var(--koala-border-primary)' : 'transparent', border: 'none', color: 'var(--koala-text-secondary)', cursor: 'pointer', transition: 'opacity 150ms ease, background 150ms ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--koala-border-primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = menuId === c.id ? 'var(--koala-border-primary)' : 'transparent'; }}>
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true"><circle cx={12} cy={5} r={1.6} /><circle cx={12} cy={12} r={1.6} /><circle cx={12} cy={19} r={1.6} /></svg>
                </button>
                {menuId === c.id && (
                  <div onClick={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 60, width: 168, background: 'var(--koala-bg-primary)', border: '1px solid var(--koala-border-primary)', borderRadius: 12, padding: 5, boxShadow: '0px 8px 24px rgba(24,26,34,0.16), 0px 2px 6px rgba(24,26,34,0.08)', animation: 'growOut 0.16s cubic-bezier(0.16,1,0.3,1)' }}>
                    <button type="button" onClick={() => { setEditingId(c.id); setEditTitle(c.title || ''); setMenuId(null); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 8px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--koala-text-primary)', fontSize: 13, fontFamily: 'var(--font-family-primary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                      <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                      Rename
                    </button>
                    <button type="button" onClick={() => { s.deleteConversation(c.id); setMenuId(null); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 8px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--koala-status-danger)', fontSize: 13, fontFamily: 'var(--font-family-primary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--koala-status-danger-bg)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
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

/** Docked, light, Twenty-style Ranksmile chat pane for the editor's right column. Pure view � all
 *  state + behaviour come from `s` (the useRanksmile hook). */
const RanksmileChatPanel = ({ s }: { s: RanksmilePanelApi }) => {
  const { response, loading } = s;
  const blocked = Boolean(s.orgUsage?.over); // org spent its shared 5h budget — composer is locked
  const empty = s.history.length === 0 && !loading && !response;
  const [helpOpen, setHelpOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [atBottom, setAtBottom] = useState(true);
  const [liveThinkOpen, setLiveThinkOpen] = useState(false);
  const { data: profile } = useProfile();
  const session = authClient.useSession?.();
  const fullName = profile?.name || session?.data?.user?.name || '';
  const firstName = (fullName.trim().split(/\s+/)[0] || 'there').replace(/[.,]$/, '');
  const voice = useAIVoice({
    value: s.prompt,
    onChange: (next) => s.setPrompt(next.slice(0, PROMPT_CHAR_LIMIT)),
    disabled: loading || blocked,
  });
  const canSend = !blocked && Boolean(s.prompt.trim());
  const charLabel = `${s.prompt.length.toLocaleString()}/${PROMPT_CHAR_LIMIT.toLocaleString()}`;

  const hasTools = s.activity.length > 0;
  const activeTool = [...s.activity].reverse().find((a) => !a.done);
  const loadingStatus = activeTool
    ? s.toolLabel(activeTool.tool)
    : hasTools
      ? 'Finishing up'
      : 'Thinking';
  const activityLines = hasTools
    ? s.activity.map((a) => ({
        text: s.toolLabel(a.tool),
        done: a.done,
        error: a.error,
      }))
    : [];
  const thinkingLen = s.streamThinkingLen || 0;
  // No-tools turns: whole stream is the answer. Tool turns: keep everything in Thinking until done.
  const streamAnswer = hasTools ? '' : s.streamText;
  const streamThinking = hasTools ? s.streamText : s.streamText.slice(0, thinkingLen);
  const showAnswerStream = shouldShowRanksmileAnswerStream({
    loading,
    streamAnswer,
    hasTools,
  });
  const showThinkingStream = Boolean(loading && hasTools && s.streamText.trim());
  const thinkingPreview = streamThinking.trim();

  const onScroll = () => {
    const el = s.scrollRef.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
  };
  const scrollToBottom = useCallback((smooth = true) => {
    const el = s.scrollRef.current;
    if (el) { el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); setAtBottom(true); }
  }, [s.scrollRef]);
  // Stick to the bottom as the conversation grows/streams � but only if the user is already there
  // (so reading older messages isn't yanked away; the � button appears instead).
  useEffect(() => {
    if (atBottom) { const el = s.scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.history, s.streamText, s.activity, s.loading, s.response]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', minHeight: 0, background: 'var(--koala-bg-primary)', borderLeft: '1px solid var(--koala-border-primary)', fontFamily: 'var(--font-family-primary)' }}>
      <style>{`
        @keyframes ranksmilespin { to { transform: rotate(360deg); } }
        .ranksmile-box:focus-within { border-color: var(--koala-border-secondary) !important; box-shadow: 0 0 0 3px rgba(248,68,22,0.10) !important; }
        .ask-smiley-icon-btn:hover:not(:disabled) { background: var(--koala-bg-secondary) !important; }
        .ask-smiley-send:hover:not(:disabled) { filter: brightness(0.97); }
      `}</style>

      {/* Header � 48px, Twenty-style */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, height: 48, padding: '0 8px 0 14px', borderBottom: '1px solid var(--koala-border-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <IconRanksmile size={18} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--koala-text-primary)' }}>Smily</span>
          <span
            style={{ position: 'relative', display: 'inline-flex' }}
            onMouseEnter={() => setHelpOpen(true)} onMouseLeave={() => setHelpOpen(false)}
          >
            <span aria-label="About Smily" style={{ display: 'inline-flex', color: 'var(--koala-text-disabled)', cursor: 'help' }}>
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx={12} cy={12} r={10} /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
            </span>
            {helpOpen && (
              <span style={{ position: 'absolute', top: 'calc(100% + 6px)', left: -2, zIndex: 250, width: 210, background: 'var(--koala-text-primary)', color: 'var(--koala-bg-primary)', fontSize: 11.5, lineHeight: '16px', padding: '8px 10px', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
                <strong style={{ fontWeight: 600 }}>Pre alpha</strong> � Smily can make mistakes; review changes before applying.
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
          {/* Conversation body � relative wrapper so the scroll-to-latest � can float over it */}
          <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div ref={s.scrollRef} onScroll={onScroll} className="styled-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {empty && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 24,
                  padding: '24px 12px',
                  textAlign: 'center',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    maxWidth: 360,
                    fontSize: 24,
                    fontWeight: 600,
                    lineHeight: '30px',
                    letterSpacing: '-1px',
                    color: 'var(--koala-text-primary)',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  Hello, {firstName}. How can I help you today?
                </p>
              </div>
            )}

            {s.history.map((entry, i) => (
              <RanksmileMessage
                key={i}
                role={entry.role}
                message={entry.message}
                thinking={entry.thinking}
                animateEnter={entry.role === 'assistant' && i === s.history.length - 1 && !loading}
              />
            ))}

            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {hasTools && (
                  <AILoadingState status={loadingStatus} lines={activityLines} />
                )}
                {!hasTools && !showAnswerStream && (
                  <AILoadingState status="Thinking" />
                )}
                {showThinkingStream && (
                  <div>
                    <button type="button" onClick={() => setLiveThinkOpen((o) => !o)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 4px', margin: '-2px -4px', borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--koala-text-disabled)', fontSize: 12.5, fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--koala-text-secondary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--koala-text-disabled)'; }}>
                      <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: liveThinkOpen ? 'rotate(90deg)' : 'none', transition: 'transform 150ms ease' }}><path d="M9 18l6-6-6-6" /></svg>
                      Thinking
                    </button>
                    {liveThinkOpen && thinkingPreview && (
                      <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid #f0f0f2', color: 'var(--koala-text-disabled)', fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{thinkingPreview}</div>
                    )}
                  </div>
                )}
                {showAnswerStream && (
                  <RanksmileStreamingMessage text={streamAnswer} streaming />
                )}
              </div>
            )}

            {response && !loading && ((response.changelog?.length ?? 0) > 0 || Boolean(s.metaPending)) && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--koala-text-disabled)', marginBottom: 5 }}>
                  WHAT RANKSMILE DID{typeof response.steps === 'number' ? ` � ${response.steps} steps` : ''}
                </div>
                {(response.changelog || []).map((c, i) => {
                  const guard = c.tool === 'guard';
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12.5, lineHeight: '18px', color: guard ? 'var(--koala-status-warning)' : 'var(--koala-text-secondary)' }}>
                      <span style={{ flexShrink: 0 }}>{guard ? '?' : '?'}</span>
                      <span>{c.summary}</span>
                    </div>
                  );
                })}
                {s.metaPending && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '2px 8px', borderRadius: 9999, background: 'rgba(242,153,100,0.1)', color: 'var(--koala-text-brand)', fontSize: 11, fontWeight: 500 }}>
                    ? Will update meta {s.metaPending}
                  </div>
                )}
              </div>
            )}

            {response && !loading && response.pendingAction?.type === 'publish_to_wordpress' && (
              <div style={{ padding: '10px 12px', borderRadius: 12, background: '#FFF8F5', border: '1px solid var(--koala-border-primary)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="var(--koala-text-brand)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 16V4" /><path d="m6 10 6-6 6 6" /><path d="M4 20h16" /></svg>
                  <div style={{ fontSize: 12.5, lineHeight: '18px', color: 'var(--koala-text-secondary)' }}>
                    Smily chce opublikowa� {response.pendingAction.title ? `�${response.pendingAction.title}� ` : ''}do WordPressa. Publikowany jest <strong style={{ fontWeight: 600, color: 'var(--koala-text-primary)' }}>zapisany</strong> artyku�.
                  </div>
                </div>
                {response.pendingAction.warning && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11.5, lineHeight: '17px', color: 'var(--koala-status-warning)' }}>
                    <span style={{ flexShrink: 0 }}>?</span><span>{response.pendingAction.warning}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={s.cancelPublish} disabled={s.publishing}
                    style={{ padding: '6px 12px', borderRadius: 6, background: 'transparent', border: 'none', cursor: s.publishing ? 'default' : 'pointer', color: 'var(--koala-text-secondary)', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-family-primary)' }}>
                    Anuluj
                  </button>
                  <button type="button" onClick={s.confirmPublish} disabled={s.publishing}
                    style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--koala-text-brand)', border: 'none', cursor: s.publishing ? 'default' : 'pointer', opacity: s.publishing ? 0.65 : 1, color: 'var(--koala-bg-primary)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-family-primary)' }}>
                    {s.publishing ? 'Publikuj�' : 'Publikuj'}
                  </button>
                </div>
              </div>
            )}

            {/* Action row only when Ranksmile actually staged something to apply/review � pure advice
                gets no Dismiss (there's nothing to dismiss; the reply stays in the conversation). */}
            {response && !loading && (s.canApply || s.canCompare) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid var(--koala-border-primary)' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {s.canCompare && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={s.openCompare}
                      style={{ flex: 1 }}
                      icon={(
                        <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx={12} cy={12} r={3} /></svg>
                      )}
                    >
                      See changes
                    </Button>
                  )}
                  {s.canApply && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={s.apply}
                      style={{ flex: 1 }}
                      icon={(
                        <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                      )}
                    >
                      Apply changes
                    </Button>
                  )}
                </div>
                <Button type="button" variant="link" size="sm" onClick={s.dismiss} style={{ alignSelf: 'center' }}>
                  Dismiss
                </Button>
              </div>
            )}
          </div>
            {!atBottom && (
              <button type="button" onClick={() => scrollToBottom()} aria-label="Scroll to latest"
                style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 5, width: 30, height: 30, borderRadius: 9999, background: 'var(--koala-bg-primary)', border: '1px solid var(--koala-border-primary)', boxShadow: '0 4px 14px rgba(24,26,34,0.14)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--koala-text-secondary)', cursor: 'pointer', transition: 'background 150ms ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--koala-bg-primary)'; }}>
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
              </button>
            )}
          </div>

          {/* Composer � Twenty-style box: textarea on top, controls + context ring inside the bottom row */}
          <div style={{ flexShrink: 0, padding: 10 }}>
            {empty && s.suggestions.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 2px 8px' }}>
                {s.suggestions.map((sug) => (
                  <Chip key={sug} size="sm" onClick={() => s.pickSuggestion(sug)}>
                    {sug}
                  </Chip>
                ))}
              </div>
            )}
            {/* Selected-text context chip � sits directly above the input box */}
            {s.selectionText && (
              <div style={{ marginBottom: 8 }}>
                <Chip
                  size="sm"
                  icon="ChatCircle"
                  onDismiss={s.clearSelection}
                  aria-label="Clear selected text"
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{s.selectionText}</span>
                </Chip>
              </div>
            )}
            {/* Org-wide budget exhausted: the whole organization shares one 5h pool. */}
            {blocked && s.orgUsage && (
              <div style={{ display: 'flex', gap: 9, padding: '10px 12px', marginBottom: 8, borderRadius: 10, background: 'var(--koala-status-danger-bg)', border: '1px solid #fecaca' }}>
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="var(--koala-status-danger)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
                <div style={{ fontSize: 12.5, lineHeight: '18px', color: '#7f1d1d' }}>
                  <span style={{ fontWeight: 600 }}>Your organization reached its AI limit.</span>{' '}
                  The shared budget resets every 5 hours � try again at{' '}
                  <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{new Date(s.orgUsage.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>.
                </div>
              </div>
            )}
            <div
              className="ranksmile-box"
              style={{
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                border: '1px solid var(--koala-border-primary)',
                borderRadius: 20,
                background: blocked ? 'var(--koala-bg-secondary)' : 'var(--koala-bg-primary)',
                boxShadow: '0px 1px 2px 0px rgba(0,0,0,0.04)',
                opacity: blocked ? 0.7 : 1,
                transition: 'border-color 150ms ease, box-shadow 150ms ease',
              }}
            >
              {voice.listening ? (
                <div style={{ padding: '16px 16px 8px' }}>
                  <AIVoicePanel
                    listening={voice.listening}
                    time={voice.time}
                    error={voice.error}
                    barHeights={voice.barHeights}
                    supported={voice.supported}
                    disabled={loading || blocked}
                    onToggle={voice.toggle}
                  />
                </div>
              ) : (
                <textarea
                  ref={s.inputRef}
                  rows={2}
                  value={s.prompt}
                  maxLength={PROMPT_CHAR_LIMIT}
                  onChange={(e) => s.setPrompt(e.target.value.slice(0, PROMPT_CHAR_LIMIT))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!blocked) s.submit(); } }}
                  placeholder={blocked ? 'AI limit reached — paused until the pool resets' : 'Write anything here...'}
                  disabled={loading || blocked}
                  className="styled-scrollbar"
                  style={{
                    display: 'block',
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: 72,
                    maxHeight: 160,
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    padding: '16px 16px 8px',
                    fontSize: 16,
                    lineHeight: '24px',
                    letterSpacing: '-0.25px',
                    color: 'var(--koala-text-primary)',
                    fontFamily: 'var(--font-family-primary)',
                    resize: 'none',
                    overflowY: 'auto',
                    flex: '0 0 auto',
                  }}
                />
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 16px 16px',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <button
                    type="button"
                    className="ask-smiley-icon-btn"
                    aria-label="Add attachment"
                    title="Attachments coming soon"
                    disabled
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 4,
                      borderRadius: 10,
                      border: '0.75px solid var(--koala-border-primary)',
                      background: 'var(--koala-bg-primary)',
                      boxShadow: '0px 1px 2px 0px rgba(0,0,0,0.04)',
                      color: 'var(--koala-text-primary)',
                      cursor: 'not-allowed',
                      opacity: 0.55,
                    }}
                  >
                    <Icon name="Plus" size={20} />
                  </button>
                  <ContextUsageRing
                    placement="up"
                    conversationTokens={s.orgUsage ? s.orgUsage.used : s.usage.conversation}
                    contextWindow={s.orgUsage ? s.orgUsage.limit : undefined}
                    resetsAt={s.orgUsage ? s.orgUsage.resetsAt : undefined}
                    lastInput={s.usage.lastInput} lastOutput={s.usage.lastOutput}
                    totalInput={s.usage.totalInput} totalOutput={s.usage.totalOutput}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      lineHeight: '20px',
                      letterSpacing: '-0.4px',
                      color: 'var(--koala-text-tertiary)',
                      fontFamily: 'var(--font-family-primary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {charLabel}
                  </span>
                  <AIVoiceButton
                    listening={voice.listening}
                    supported={voice.supported}
                    disabled={loading || blocked}
                    onToggle={voice.toggle}
                  />
                  <button
                    type="button"
                    className="ask-smiley-send"
                    onClick={loading ? s.stop : () => { if (voice.listening) voice.stop(); s.submit(); }}
                    disabled={loading ? false : !canSend}
                    aria-label={loading ? 'Stop' : 'Send'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      borderRadius: 10,
                      border: 'none',
                      background: loading ? 'var(--koala-text-primary)' : 'var(--koala-bg-secondary)',
                      color: loading ? 'var(--koala-bg-primary)' : (canSend ? 'var(--koala-text-primary)' : 'var(--koala-text-tertiary)'),
                      cursor: loading || canSend ? 'pointer' : 'not-allowed',
                      fontSize: 14,
                      fontWeight: 500,
                      lineHeight: '20px',
                      letterSpacing: '-0.4px',
                      fontFamily: 'var(--font-family-primary)',
                      flexShrink: 0,
                    }}
                  >
                    {loading
                      ? <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true"><rect x={7.5} y={7.5} width={9} height={9} rx={2} fill="currentColor" /></svg>
                      : <Icon name="ArrowUp" size={16} />}
                    {loading ? 'Stop' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RanksmileChatPanel;
