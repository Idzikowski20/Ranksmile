import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../lib/errors';
import { CompactSelect, Select } from '../koala/core';
import Modal from '../koala/core/modal/modal';
import Button from '../koala/core/button/button';
import Input from '../koala/core/input/input';

// WP taxonomy/term labels can carry HTML entities (e.g. "Tips &amp; Hacks") — decode for display.
const decodeLabel = (s: string): string => {
  if (typeof document === 'undefined') return s;
  const el = document.createElement('textarea');
  el.innerHTML = s ?? '';
  return el.value;
};

const F = 'var(--font-family-primary)';

type Opt = { value: string | number; label: string };
type Options = {
  siteUrl: string;
  types: Opt[];
  categories: Opt[];
  tags: Opt[];
  authors: Opt[];
  statuses: Opt[];
  wpPostId: number | null;
  defaultTitle: string;
  metaTitle: string;
  metaDescription: string;
};

interface Props {
  articleId: number;
  onClose: () => void;
}

const IcoX = ({ size = 22 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
);

const IcoInfo = () => (<svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75s-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12m9.75-3a.75.75 0 1 0 0-1.5a.75.75 0 0 0 0 1.5m-.75 2.25a.75.75 0 0 1 1.5 0v5a.75.75 0 0 1-1.5 0z" /></svg>);
const IcoDocPlus = () => (<svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875M12.75 12a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V18a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25z" /><path d="M14.25 5.25a5.23 5.23 0 0 0-1.279-3.434a9.77 9.77 0 0 1 6.963 6.963A5.23 5.23 0 0 0 16.5 7.5h-1.875a.375.375 0 0 1-.375-.375z" /></svg>);
const IcoSync = () => (<svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M16.023 9.348h4.992M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>);
const IcoArrowLeft = () => (<svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>);
const IcoArrowRight = () => (<svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>);
const IcoChevronRight = () => (<svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="m8.25 4.5l7.5 7.5l-7.5 7.5" /></svg>);

const Label = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: 13, fontWeight: 500, color: '#3f3f47' }}>{children}</span>
);

const toSelectOptions = (options: Opt[]) => options.map((o) => ({
  value: String(o.value),
  label: decodeLabel(o.label),
}));

const WordPressExportModal = ({ articleId, onClose }: Props) => {
  const [opts, setOpts] = useState<Options | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<'choose' | 'details' | 'success'>('choose');
  const [mode, setMode] = useState<'create' | 'update' | null>(null);
  const [showBanner, setShowBanner] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ post_id?: number; edit_post_url?: string; post_url?: string } | null>(null);

  // form
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('draft');
  const [type, setType] = useState('post');
  const [categories, setCategories] = useState<Array<string | number>>([]);
  const [tags, setTags] = useState<Array<string | number>>([]);
  const [author, setAuthor] = useState<string>('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`/api/wordpress/post-options?articleId=${articleId}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d?.error || 'Could not load options'); return d as Options; })
      .then((d) => {
        if (!active) return;
        const dec = (arr: Opt[]) => (arr || []).map((o) => ({ value: o.value, label: decodeLabel(String(o.label ?? '')) }));
        setOpts({ ...d, types: dec(d.types), categories: dec(d.categories), tags: dec(d.tags), authors: dec(d.authors), statuses: dec(d.statuses) });
        setTitle(d.defaultTitle || '');
        setMetaTitle(d.metaTitle || '');
        setMetaDescription(d.metaDescription || '');
        setType(d.types[0] ? String(d.types[0].value) : 'post');
        setAuthor(d.authors[0] ? String(d.authors[0].value) : '');
      })
      .catch((e) => { if (active) setLoadError(e?.message || 'Could not load options'); });
    return () => { active = false; };
  }, [articleId]);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/wordpress/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId,
          mode,
          status,
          title,
          metaTitle,
          metaDescription,
          type: { value: type },
          author: author ? { value: author } : undefined,
          categories: categories.map((v) => ({ value: v })),
          tags: tags.map((v) => ({ value: v })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'WordPress export failed');
      setResult(data);
      setStep('success');
      // Record ActionExecuted (publish) — non-blocking.
      fetch(`/api/articles/${articleId}/execute-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed: true,
          action: {
            id: `publish-${articleId}`,
            type: 'publish',
            title: 'Publish to WordPress',
            instruction: 'Publish',
            expectedLift: 0,
            confidence: 1,
            cost: 'easy',
            reason: 'User confirmed WordPress publish',
            origin: 'planner',
            appliesTo: { kind: 'article', id: String(articleId) },
          },
        }),
      }).catch(() => {});
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'WordPress export failed');
    } finally {
      setSubmitting(false);
    }
  };

  const host = useMemo(() => { try { return opts ? new URL(opts.siteUrl).host : ''; } catch { return opts?.siteUrl || ''; } }, [opts]);
  // Edit link → https://<site>/wp-admin/post.php?post=<id>&action=edit (fall back to the plugin URL).
  const editUrl = useMemo(() => {
    if (result?.post_id && opts?.siteUrl) return `${opts.siteUrl.replace(/\/+$/, '')}/wp-admin/post.php?post=${result.post_id}&action=edit`;
    return result?.edit_post_url || null;
  }, [result, opts]);

  return (
    <Modal onClose={onClose} width={600} closeOnOverlayClick>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: F }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 12px' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#18181b' }}>Export to WordPress</h2>
          <Button type="button" variant="transparent" size="sm" onClick={onClose} aria-label="Close" icon={<IcoX />} />
        </div>

        {/* Body */}
        <div className="styled-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0 24px 8px' }}>
          {loadError && <div style={{ fontSize: 14, color: '#E5484D', padding: '12px 0' }}>{loadError}</div>}
          {!opts && !loadError && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '4px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ width: 70, height: 12, borderRadius: 6, background: '#F0F0F4', animation: 'skeletonPulse 1.5s ease-in-out infinite' }} />
                <div style={{ width: 190, height: 16, borderRadius: 6, background: '#F0F0F4', animation: 'skeletonPulse 1.5s ease-in-out infinite' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ width: 150, height: 12, borderRadius: 6, background: '#F0F0F4', animation: 'skeletonPulse 1.5s ease-in-out infinite' }} />
                <div style={{ height: 52, borderRadius: 12, background: '#F5F5F9', animation: 'skeletonPulse 1.5s ease-in-out infinite' }} />
                <div style={{ height: 52, borderRadius: 12, background: '#F5F5F9', animation: 'skeletonPulse 1.5s ease-in-out infinite', animationDelay: '0.08s' }} />
              </div>
            </div>
          )}

          {opts && step === 'choose' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {showBanner && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#eff6ff', borderRadius: 10, padding: 14 }}>
                  <span style={{ flexShrink: 0, color: '#2563eb', display: 'inline-flex', marginTop: 1 }}><IcoInfo /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#18181b' }}>Connect more domains</div>
                    <span style={{ fontSize: 13, lineHeight: '19px', color: '#3f3f47' }}>You can connect more than one WordPress site to your account. <a href="/settings/wordpress" target="_blank" rel="noreferrer noopener" style={{ color: '#2563eb', textDecoration: 'underline' }}>Learn more</a></span>
                  </div>
                  <Button type="button" variant="transparent" size="sm" onClick={() => setShowBanner(false)} aria-label="Dismiss" icon={<IcoX size={18} />} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Label>Domain</Label>
                <span style={{ fontWeight: 600, color: '#18181b' }}>{opts.siteUrl}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Label>What do you want to do?</Label>
                {([{ k: 'create', t: 'Create new Draft', icon: <IcoDocPlus /> }, { k: 'update', t: 'Update existing Post', icon: <IcoSync /> }] as const).map(({ k, t, icon }) => {
                  const disabled = k === 'update' && !opts.wpPostId;
                  const sel = mode === k;
                  return (
                    <button type="button" key={k} disabled={disabled} onClick={() => setMode(k)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', border: `1px solid ${sel ? '#F84416' : '#e4e4e7'}`, borderRadius: 12, background: '#fff', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, fontFamily: F, textAlign: 'left' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ color: '#18181b', display: 'inline-flex' }}>{icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#18181b' }}>{t}{disabled && <span style={{ fontSize: 12, color: '#9f9fa9', fontWeight: 400 }}> (not published yet)</span>}</span>
                      </span>
                      <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', border: `2px solid ${sel ? '#F84416' : '#d4d4d8'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        {sel && <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F84416' }} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {opts && step === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#f4f4f5', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 13, color: '#52525c' }}>Domain</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#18181b' }}>{opts.siteUrl}</span>
              </div>
              <span style={{ fontSize: 14, color: '#52525c' }}>{mode === 'create' ? 'A new post will be created with the following settings:' : 'The linked post will be updated with the following settings:'}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><Label>Status</Label><Select size="md" width="100%" placeholder="– Select –" value={status} onChange={setStatus} options={toSelectOptions(opts.statuses)} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><Label>Type</Label><Select size="md" width="100%" placeholder="– Select –" value={type} onChange={setType} options={toSelectOptions(opts.types.length ? opts.types : [{ value: 'post', label: 'Post' }])} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Label>Category</Label>
                <CompactSelect
                  multiple
                  size="sm"
                  value={categories}
                  triggerLabel="– Select options –"
                  emptyMessage="None available"
                  options={opts.categories.map((o) => ({ value: o.value, label: decodeLabel(o.label), textValue: decodeLabel(o.label) }))}
                  onChange={(selected) => setCategories(selected.map((o) => o.value))}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Label>Tags</Label>
                <CompactSelect
                  multiple
                  size="sm"
                  value={tags}
                  triggerLabel="– Select options –"
                  emptyMessage="None available"
                  options={opts.tags.map((o) => ({ value: o.value, label: decodeLabel(o.label), textValue: decodeLabel(o.label) }))}
                  onChange={(selected) => setTags(selected.map((o) => o.value))}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><Label>Author</Label><Select size="md" width="100%" placeholder="– Select –" value={author} onChange={setAuthor} options={toSelectOptions(opts.authors.length ? opts.authors : [{ value: '', label: 'Default' }])} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><Label>Meta title</Label><Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><Label>Meta description</Label><Input value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} /></div>
            </div>
          )}

          {step === 'success' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0 16px' }}>
              <span style={{ flexShrink: 0, marginTop: 2, width: 22, height: 22, borderRadius: '50%', background: '#1AB25E', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M16.7 5.2 8.7 15.7l-4.5-4.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#18181b' }}>High five!</div>
                <span style={{ fontSize: 14, color: '#52525c' }}>Your WordPress {host ? `(${host})` : ''} has been updated and synced.</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #f4f4f5', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          {step === 'choose' && (
            <>
              <a href="/settings/wordpress" target="_blank" rel="noreferrer noopener" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500, color: '#3f3f47', textDecoration: 'none' }}>Manage WordPress Integrations <IcoChevronRight /></a>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button type="button" variant="transparent" onClick={onClose}>Cancel</Button>
                <Button type="button" variant="primary" onClick={() => setStep('details')} disabled={!opts || !mode}>
                  Next <IcoArrowRight />
                </Button>
              </div>
            </>
          )}
          {step === 'details' && (
            <>
              <Button type="button" variant="transparent" onClick={() => setStep('choose')}>
                <IcoArrowLeft /> Back
              </Button>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button type="button" variant="transparent" onClick={onClose}>Cancel</Button>
                <Button type="button" variant="primary" onClick={submit} disabled={submitting || !title.trim()} busy={submitting}>
                  {submitting ? 'Working…' : <><IcoDocPlus /> {mode === 'create' ? 'Create New Post' : 'Update Post'}</>}
                </Button>
              </div>
            </>
          )}
          {step === 'success' && (
            <>
              <Button type="button" variant="transparent" onClick={onClose}>Close</Button>
              {editUrl && (
                <Button type="button" variant="primary" onClick={() => window.open(editUrl, '_blank', 'noopener')}>
                  Edit in WordPress <IcoArrowRight />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default WordPressExportModal;
