import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import { useWorkspaces } from '../../services/workspaces';
import { useFetchDomains } from '../../services/domains';
import { deriveActiveId, workspaceHref } from '../../lib/activeWorkspace';
import {
  IconDashboard, IconIssues, IconCompass, IconSiren, IconSettings,
  IconFire, IconGlobe, IconBuilding, IconDocs,
} from './nav/sentryIcons';

const ICO = 14;

const SearchIcon = ({ size = 16 }: { size?: number }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 0 0 0-11M2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9" clipRule="evenodd" />
  </svg>
);

type PaletteItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  keywords: string[];
};

type PaletteSection = {
  title: string;
  items: PaletteItem[];
};

function useCommandSections(): PaletteSection[] {
  const router = useRouter();
  const { data: wsData } = useWorkspaces();
  const { data: domainsData } = useFetchDomains({} as never);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const wsId = deriveActiveId(mounted, router.asPath, wsData?.activeId);
  const slug = domainsData?.domains?.[0]?.slug ?? null;

  return useMemo(() => {
    const ws = (p: string) => workspaceHref(wsId, p);
    const sections: PaletteSection[] = [
      {
        title: 'Go to…',
        items: [
          { id: 'dashboard', label: 'Dashboard', href: ws('/dashboard'), icon: <IconDashboard size={ICO} />, keywords: ['overview', 'home'] },
          { id: 'content-editor', label: 'Content Editor', href: ws('/articles'), icon: <IconIssues size={ICO} />, keywords: ['articles', 'content'] },
          { id: 'settings', label: 'Settings', href: '/settings/general', icon: <IconSettings size={ICO} />, keywords: ['preferences', 'account'] },
        ],
      },
    ];

    if (slug) {
      sections.push({
        title: 'SEO',
        items: [
          { id: 'performance', label: 'Performance', href: ws(`/sites/${slug}`), icon: <IconCompass size={ICO} />, keywords: ['gsc', 'traffic'] },
          { id: 'recommendations', label: 'Recommendations', href: ws(`/sites/${slug}/recommendations`), icon: <IconFire size={ICO} />, keywords: ['optimize'] },
          { id: 'content-audit', label: 'Content Audit', href: ws(`/sites/${slug}/content-audit`), icon: <IconIssues size={ICO} />, keywords: ['audit'] },
          { id: 'topical-map', label: 'Topical Map', href: ws(`/sites/${slug}/topical-map`), icon: <IconCompass size={ICO} />, keywords: ['topics', 'clusters'] },
          { id: 'activity-log', label: 'Activity Log', href: ws(`/sites/${slug}/activity-log`), icon: <IconDocs size={ICO} />, keywords: ['history', 'log'] },
        ],
      });
      sections.push({
        title: 'AI Visibility',
        items: [
          { id: 'ai-overview', label: 'Overview', href: ws(`/sites/${slug}/ai-visibility/overview`), icon: <IconSiren size={ICO} />, keywords: ['ai vis'] },
          { id: 'ai-sources', label: 'Sources', href: ws(`/sites/${slug}/ai-visibility/sources`), icon: <IconGlobe size={ICO} />, keywords: ['citations'] },
          { id: 'ai-competitors', label: 'Competitors', href: ws(`/sites/${slug}/ai-visibility/competitors`), icon: <IconBuilding size={ICO} />, keywords: ['rivals'] },
          { id: 'ai-prompts', label: 'Prompts', href: ws(`/sites/${slug}/ai-visibility/prompts`), icon: <IconDocs size={ICO} />, keywords: ['queries'] },
          { id: 'ai-fanout', label: 'Fanout Queries', href: ws(`/sites/${slug}/ai-visibility/fanout-queries`), icon: <IconCompass size={ICO} />, keywords: ['fanout'] },
        ],
      });
    }

    return sections;
  }, [wsId, slug]);
}

const matchesQuery = (item: PaletteItem, q: string) => {
  const hay = [item.label, ...item.keywords].join(' ').toLowerCase();
  return hay.includes(q);
};

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="command-palette-kbd">{children}</kbd>
);

const CommandMenu = ({ open, onClose, sections }: {
  open: boolean; onClose: () => void; sections: PaletteSection[];
}) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((section) => ({ ...section, items: section.items.filter((item) => matchesQuery(item, q)) }))
      .filter((section) => section.items.length > 0);
  }, [sections, query]);

  const flatItems = useMemo(
    () => filteredSections.flatMap((section) => section.items),
    [filteredSections],
  );

  useEffect(() => { if (open) { setQuery(''); setSel(0); inputRef.current?.focus(); } }, [open]);
  useEffect(() => { if (sel > flatItems.length - 1) setSel(Math.max(0, flatItems.length - 1)); }, [flatItems, sel]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [sel, open, flatItems]);

  const go = (item?: PaletteItem, newTab = false) => {
    if (!item) return;
    onClose();
    if (newTab) window.open(item.href, '_blank', 'noopener,noreferrer');
    else router.push(item.href);
  };

  if (!open || typeof document === 'undefined') return null;

  let itemIndex = -1;

  return createPortal(
    <div className="command-palette-overlay" role="presentation" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Command Menu"
        className="command-palette"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="command-palette-input-row">
          <span className="command-palette-input-icon" aria-hidden="true"><SearchIcon size={14} /></span>
          <input
            ref={inputRef}
            aria-label="Search commands"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(flatItems.length - 1, s + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); go(flatItems[sel], e.shiftKey); }
              else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            }}
            placeholder="Search for commands..."
            autoComplete="off"
            spellCheck={false}
            className="command-palette-input"
          />
        </div>

        <div ref={listRef} className="command-palette-results styled-scrollbar" role="listbox" aria-label="Search results">
          {flatItems.length === 0 ? (
            <div className="command-palette-empty">No results.</div>
          ) : (
            <ul className="command-palette-list">
              {filteredSections.map((section) => (
                <React.Fragment key={section.title}>
                  <li className="command-palette-section-header" aria-hidden="true">
                    <span>{section.title}</span>
                  </li>
                  {section.items.map((item) => {
                    itemIndex += 1;
                    const active = itemIndex === sel;
                    return (
                      <li key={item.id} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          data-active={active ? 'true' : undefined}
                          onMouseEnter={() => setSel(itemIndex)}
                          onClick={() => go(item)}
                          className={`command-palette-item${active ? ' command-palette-item--active' : ''}`}
                        >
                          <span className="command-palette-item-icon" aria-hidden="true">{item.icon}</span>
                          <span className="command-palette-item-label">{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </React.Fragment>
              ))}
            </ul>
          )}
        </div>

        <div className="command-palette-footer">
          <div className="command-palette-footer-hints">
            <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> Move</span>
            <span><Kbd>↵</Kbd> Select</span>
            <span><Kbd>⇧</Kbd> <Kbd>↵</Kbd> New tab</span>
          </div>
          <span className="command-palette-footer-toggle">
            Toggle Command Palette <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const TopbarSearch = () => {
  const [open, setOpen] = useState(false);
  const sections = useCommandSections();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        className="sentry-nav-utilbtn global-topbar-search-btn"
        aria-label="Search"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <SearchIcon />
        <span className="global-topbar-search-label">Search</span>
        <span className="global-topbar-search-kbd">Ctrl K</span>
      </button>

      <CommandMenu open={open} onClose={() => setOpen(false)} sections={sections} />
    </>
  );
};

export default TopbarSearch;
