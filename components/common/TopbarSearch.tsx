import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import { useWorkspaces } from '../../services/workspaces';
import { useFetchDomains } from '../../services/domains';
import { deriveActiveId, workspaceHref } from '../../lib/activeWorkspace';

const font = 'var(--font-family-primary)';

const SearchIcon = ({ size = 20 }: { size?: number }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 0 0 0-11M2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9" clipRule="evenodd" />
  </svg>
);

type Command = { label: string; category: string; href: string };

/** Workspace/site-scoped destinations, mirroring the sidebar's real routes. */
function useCommands(): Command[] {
  const router = useRouter();
  const { data: wsData } = useWorkspaces();
  const { data: domainsData } = useFetchDomains({} as never);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const wsId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
  const slug = domainsData?.domains?.[0]?.slug ?? null;

  return useMemo(() => {
    const ws = (p: string) => workspaceHref(wsId, p);
    const cmds: Command[] = [
      { label: 'Dashboard', category: 'Navigation', href: ws('/dashboard') },
      { label: 'Content Editor', category: 'Tools', href: ws('/articles') },
      { label: 'Keyword Research', category: 'Tools', href: ws('/research') },
      { label: 'AI Humanizer', category: 'Tools', href: ws('/content-editor') },
    ];
    if (slug) {
      cmds.push(
        { label: 'Recommendations', category: 'Sites', href: ws(`/sites/${slug}/recommendations`) },
        { label: 'Performance', category: 'Sites', href: ws(`/sites/${slug}`) },
        { label: 'Content Audit', category: 'Sites', href: ws(`/sites/${slug}/content-audit`) },
        { label: 'Topical Map', category: 'Sites', href: ws(`/sites/${slug}/topical-map`) },
        { label: 'Activity Log', category: 'Sites', href: ws(`/sites/${slug}/activity-log`) },
      );
    }
    return cmds;
  }, [wsId, slug]);
}

const CommandMenu = ({ open, onClose, commands, anchorRef }: {
  open: boolean; onClose: () => void; commands: Command[]; anchorRef: React.RefObject<HTMLElement>;
}) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => { if (open) { setQuery(''); setSel(0); } }, [open]);
  useEffect(() => { if (sel > filtered.length - 1) setSel(Math.max(0, filtered.length - 1)); }, [filtered, sel]);

  // Anchor the menu directly under the search trigger (centered on it), clamped to the viewport.
  useEffect(() => {
    if (!open) return undefined;
    const compute = () => {
      const w = Math.min(600, window.innerWidth - 16);
      const el = anchorRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8));
        setPos({ top: r.bottom + 6, left, width: w });
      } else {
        setPos({ top: 70, left: (window.innerWidth - w) / 2, width: w });
      }
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [open, anchorRef]);

  const go = (cmd?: Command) => { if (cmd) { onClose(); router.push(cmd.href); } };

  if (!open || !pos || typeof document === 'undefined') return null;

  return createPortal(
    <div role="presentation" onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(0,0,0,0.6)' }}>
      <div
        role="dialog"
        aria-label="Command Menu"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#18181B', border: '1px solid #221E28', borderRadius: 12, boxShadow: '0 24px 60px rgba(0,0,0,0.5)', fontFamily: font, animation: 'growOut 0.16s cubic-bezier(0.16,1,0.3,1)' }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid #221E28', background: '#09090B' }}>
          <span style={{ color: '#9F9FA9', display: 'inline-flex' }}><SearchIcon size={20} /></span>
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(filtered.length - 1, s + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); go(filtered[sel]); }
              else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            }}
            placeholder="Search…"
            autoComplete="off"
            spellCheck={false}
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: '#FFFFFF', fontSize: 15, fontFamily: font }}
          />
        </div>

        {/* Results */}
        <div className="styled-scrollbar" style={{ padding: 8, overflowY: 'auto', background: '#09090B' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: '#71717B', fontSize: 14 }}>No results.</div>
          ) : (
            <>
              <div style={{ padding: '10px 12px 4px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#71717B' }}>Suggestions</div>
              {filtered.map((cmd, i) => {
                const active = i === sel;
                return (
                  <button
                    key={`${cmd.category}-${cmd.label}`}
                    type="button"
                    onMouseEnter={() => setSel(i)}
                    onClick={() => go(cmd)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: active ? '#2F2F34' : 'transparent', color: active ? '#FFFFFF' : '#9F9FA9', fontFamily: font, fontSize: 14, fontWeight: 500, transition: 'background 120ms ease, color 120ms ease' }}
                  >
                    <span>{cmd.label}</span>
                    <span style={{ color: '#71717B', fontSize: 12, fontWeight: 500 }}>{cmd.category}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

const TopbarSearch = ({ compact = false }: { compact?: boolean }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const commands = useCommands();

  // Ctrl/⌘+K toggles the command menu. Only the full-bar instance owns the
  // shortcut (the compact icon is a duplicate rendered on narrow screens).
  useEffect(() => {
    if (compact) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [compact]);

  if (compact) {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Search"
          onClick={() => setOpen(true)}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.8'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 9999, border: 'none', cursor: 'pointer',
            background: 'transparent', color: '#9F9FA9', transition: 'opacity 150ms ease',
          }}
        >
          <SearchIcon size={20} />
        </button>
        <CommandMenu open={open} onClose={() => setOpen(false)} commands={commands} anchorRef={triggerRef} />
      </>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.8'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          width: '100%', height: 40, padding: '0 12px', borderRadius: 9999, border: 'none',
          cursor: 'pointer', background: '#18181B', color: '#9F9FA9', fontFamily: font,
          fontSize: 14, fontWeight: 500, transition: 'opacity 150ms ease',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <SearchIcon />
          Search
        </span>
        <span className="topbar-search-kbd" style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4, background: '#09090B', color: '#9F9FA9', fontSize: 14, lineHeight: '16px' }}>
          Ctrl+K
        </span>
      </button>

      <CommandMenu open={open} onClose={() => setOpen(false)} commands={commands} anchorRef={triggerRef} />
    </>
  );
};

export default TopbarSearch;
