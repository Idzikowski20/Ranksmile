import React, { useRef, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';

const F = 'var(--font-family-primary)';

interface Props {
  score: number;
  html: string;
  plainText: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  onMetaTitleChange: (v: string) => void;
  onMetaDescriptionChange: (v: string) => void;
  keyword?: string;
  featuredImage?: { url: string; alt: string } | null;
  onFeaturedImageChange?: (img: { url: string; alt: string } | null) => void;
  isDone: boolean;
  onMarkDone: () => void;
  readOnly?: boolean;
  onBack: () => void;
}

/* ── HTML → Markdown (lightweight, browser-only) ───────────────────── */
const htmlToMarkdown = (html: string): string => {
  if (typeof window === 'undefined') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const inline = (n: Node): string => Array.from(n.childNodes).map(render).join('');
  const render = (n: Node): string => {
    if (n.nodeType === 3) return n.textContent || '';
    if (n.nodeType !== 1) return '';
    const el = n as HTMLElement;
    const kids = inline(el);
    switch (el.tagName.toLowerCase()) {
      case 'h1': return `\n# ${kids}\n`;
      case 'h2': return `\n## ${kids}\n`;
      case 'h3': return `\n### ${kids}\n`;
      case 'h4': return `\n#### ${kids}\n`;
      case 'h5': return `\n##### ${kids}\n`;
      case 'h6': return `\n###### ${kids}\n`;
      case 'p': return `\n${kids}\n`;
      case 'br': return '  \n';
      case 'strong': case 'b': return `**${kids}**`;
      case 'em': case 'i': return `*${kids}*`;
      case 'a': return `[${kids}](${el.getAttribute('href') || ''})`;
      case 'ul': return `\n${Array.from(el.children).map((li) => `- ${inline(li)}`).join('\n')}\n`;
      case 'ol': return `\n${Array.from(el.children).map((li, i) => `${i + 1}. ${inline(li)}`).join('\n')}\n`;
      case 'blockquote': return `\n> ${kids}\n`;
      case 'img': return `![${el.getAttribute('alt') || ''}](${el.getAttribute('src') || ''})`;
      default: return kids;
    }
  };
  return inline(doc.body).replace(/\n{3,}/g, '\n\n').trim();
};

const slugify = (s: string) => (s || 'article').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'article';

const download = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
};

/* ── Reusable bits ─────────────────────────────────────────────────── */
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: 14, fontWeight: 600, color: '#18181b', fontFamily: F }}>{children}</span>
);

const Divider = () => <div style={{ minHeight: 1, height: 1, flexShrink: 0, background: '#f4f4f5', alignSelf: 'stretch' }} />;

const CopyIconBtn = ({ onClick, title }: { onClick: () => void; title: string }) => (
  <button type="button" title={title} onClick={onClick}
    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#3f3f47', display: 'inline-flex', lineHeight: 1 }}
    onMouseEnter={(e) => { e.currentTarget.style.color = '#18181b'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#3f3f47'; }}>
    <svg viewBox="0 0 24 24" width={16} height={16}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m8.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 0 0-2.25 2.25v6" /></svg>
  </button>
);

const ExportCard = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
  <button type="button" onClick={onClick}
    style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 16px', borderRadius: 12, border: '1px solid #e4e4e7', background: '#f4f4f5', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#18181b', fontFamily: F, transition: 'opacity 0.15s' }}
    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}>
    <span style={{ display: 'inline-flex', color: '#18181b' }}>{icon}</span>
    {label}
  </button>
);

const IcoContent = <svg width={20} height={20} viewBox="0 0 24 24" fill="none"><path d="M14 2.27V6.4c0 .56 0 .84.11 1.05.1.19.25.34.44.44.21.11.49.11 1.05.11h4.13M16 13H8m8 4H8m2-8H8m6-7H8.8c-1.68 0-2.52 0-3.16.33a3 3 0 0 0-1.31 1.3C4 4.28 4 5.12 4 6.8v10.4c0 1.68 0 2.52.33 3.16a3 3 0 0 0 1.3 1.31C6.28 22 7.12 22 8.8 22h6.4c1.68 0 2.52 0 3.16-.33a3 3 0 0 0 1.31-1.3c.33-.64.33-1.48.33-3.16V8l-6-6Z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IcoHtml = <svg width={20} height={20} viewBox="0 0 24 24" fill="none"><path d="M17 17l5-5-5-5M7 7l-5 5 5 5M14 3l-4 18" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>;
const IcoMd = <svg width={20} height={20} viewBox="0 0 24 24" fill="none"><path d="M4 8h16M4 16h16M8 3v18M16 3v18" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>;

const PublishExportPanel = ({ score, html, plainText, title, metaTitle, metaDescription, onMetaTitleChange, onMetaDescriptionChange, keyword, featuredImage, onFeaturedImageChange, isDone, onMarkDone, readOnly, onBack }: Props) => {
  const router = useRouter();
  const [doneCardOpen, setDoneCardOpen] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(() => toast.success(`${label} copied`)).catch(() => toast.error('Copy failed'));
  };
  const fname = slugify(title);

  const readImage = (file: File | undefined | null) => {
    if (readOnly || !file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => onFeaturedImageChange?.({ url: reader.result as string, alt: featuredImage?.alt || title || keyword || '' });
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', fontFamily: F }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={onBack} title="Back"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: 'none', background: '#f4f4f5', cursor: 'pointer', color: '#18181b' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#e4e4e7'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#f4f4f5'; }}>
            <svg viewBox="0 0 20 20" width={20} height={20}><path fill="currentColor" fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0" clipRule="evenodd" /></svg>
          </button>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#18181b' }}>Publish or Export</span>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }} className="styled-scrollbar">
        {/* Meta tags */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 16px' }}>
          <SectionTitle>Meta tags</SectionTitle>
          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#3f3f47', fontFamily: F }}>Title</span>
              <CopyIconBtn title="Copy title" onClick={() => copy(metaTitle, 'Title')} />
            </div>
            <textarea
              value={metaTitle} maxLength={70} placeholder="Meta title…" rows={2} readOnly={readOnly}
              onChange={(e) => onMetaTitleChange(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', minHeight: 60, padding: '8px 12px', borderRadius: 8, border: '1px solid #d4d4d8', outline: 'none', resize: 'vertical', fontSize: 14, fontFamily: F, color: '#18181b', lineHeight: '20px', background: readOnly ? '#f8f8f9' : '#fff', cursor: readOnly ? 'default' : 'text' }}
            />
            <span style={{ alignSelf: 'flex-end', fontSize: 13, color: metaTitle.length >= 70 ? '#e5484d' : '#52525c', fontFamily: F }}>{metaTitle.length}/70</span>
          </div>
          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#3f3f47', fontFamily: F }}>Description</span>
              <CopyIconBtn title="Copy description" onClick={() => copy(metaDescription, 'Description')} />
            </div>
            <textarea
              value={metaDescription} maxLength={156} placeholder="Meta description…" rows={5} readOnly={readOnly}
              onChange={(e) => onMetaDescriptionChange(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', minHeight: 116, padding: '8px 12px', borderRadius: 8, border: '1px solid #d4d4d8', outline: 'none', resize: 'vertical', fontSize: 14, fontFamily: F, color: '#18181b', lineHeight: '20px', background: readOnly ? '#f8f8f9' : '#fff', cursor: readOnly ? 'default' : 'text' }}
            />
            <span style={{ alignSelf: 'flex-end', fontSize: 13, color: metaDescription.length >= 156 ? '#e5484d' : '#52525c', fontFamily: F }}>{metaDescription.length}/156</span>
          </div>
        </div>

        <Divider />

        {/* Featured image */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px' }}>
          <SectionTitle>Featured image</SectionTitle>
          {featuredImage?.url ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e4e4e7' }}>
                <img src={featuredImage.url} alt={featuredImage.alt || 'Featured'} style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
              </div>
              <input
                type="text" value={featuredImage.alt} placeholder="Alt text…" readOnly={readOnly}
                onChange={(e) => onFeaturedImageChange?.({ url: featuredImage.url, alt: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', height: 38, padding: '0 12px', borderRadius: 8, border: '1px solid #d4d4d8', outline: 'none', fontSize: 14, fontFamily: F, color: '#18181b', background: readOnly ? '#f8f8f9' : '#fff' }}
              />
              {!readOnly && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => fileRef.current?.click()}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', boxShadow: 'inset 0 0 0 1px #e4e4e7', background: 'transparent', color: '#3f3f47', fontSize: 14, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f4f5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>Replace</button>
                  <button type="button" onClick={() => onFeaturedImageChange?.(null)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', boxShadow: 'inset 0 0 0 1px #e4e4e7', background: 'transparent', color: '#e5484d', fontSize: 14, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>Remove</button>
                </div>
              )}
            </div>
          ) : (
            <div
              role="button" tabIndex={readOnly ? -1 : 0}
              onClick={() => { if (!readOnly) fileRef.current?.click(); }}
              onDragOver={(e) => { if (readOnly) return; e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); readImage(e.dataTransfer.files?.[0]); }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '28px 16px', borderRadius: 12, border: `1.5px dashed ${dragOver ? '#AA93FD' : '#d4d4d8'}`, background: dragOver ? 'rgba(120,58,251,0.05)' : '#fff', cursor: readOnly ? 'not-allowed' : 'pointer', textAlign: 'center', transition: 'border-color 0.15s, background 0.15s', opacity: readOnly ? 0.6 : 1 }}>
              <svg width={42} height={42} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="6" y="3" width="15" height="13" rx="2.5" fill="#C7BCFB" />
                <rect x="3" y="7" width="15" height="13" rx="2.5" fill="#783AFB" />
                <circle cx="7.5" cy="11.5" r="1.6" fill="#fff" />
                <path d="M4 18l4.2-4 3 2.6 3-2.8L18 18" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <span style={{ fontSize: 14, color: '#52525c', fontFamily: F }}>Drop your image here, or <span style={{ color: '#783AFB', fontWeight: 600 }}>browse</span></span>
              <span style={{ fontSize: 12, color: '#9f9fa9', fontFamily: F }}>Supports: PNG, JPG, JPEG, WEBP</span>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" hidden onChange={(e) => readImage(e.target.files?.[0])} />
        </div>

        <Divider />

        {/* Export → WordPress */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 16px' }}>
          <SectionTitle>Export</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" disabled={readOnly} onClick={readOnly ? undefined : () => router.push('/settings/wordpress')}
              style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 16px', borderRadius: 6, border: 'none', background: '#18181b', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: F, cursor: readOnly ? 'not-allowed' : 'pointer', opacity: readOnly ? 0.5 : 1, transition: 'background 0.15s' }}
              onMouseEnter={(e) => { if (!readOnly) e.currentTarget.style.background = '#783afb'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#18181b'; }}>
              <svg width={20} height={20} viewBox="0 0 20 20" fill="none"><path d="M10 0C4.49 0 0 4.48 0 10s4.49 10 10 10 10-4.49 10-10S15.51 0 10 0ZM1.01 10c0-1.3.28-2.54.78-3.66l4.29 11.75A8.99 8.99 0 0 1 1.01 10ZM10 18.99c-.88 0-1.73-.13-2.54-.37l2.7-7.84 2.76 7.57.06.13c-.93.33-1.93.51-2.98.51Zm1.24-13.2c.54-.03 1.03-.09 1.03-.09.48-.06.43-.77-.06-.74 0 0-1.46.11-2.4.11-.88 0-2.37-.11-2.37-.11-.48-.03-.54.71-.06.74 0 0 .46.06.94.09l1.4 3.84-1.97 5.9L4.48 5.79c.55-.03 1.03-.09 1.03-.09.49-.06.43-.77-.06-.74 0 0-1.45.11-2.39.11-.17 0-.37 0-.58-.01A8.98 8.98 0 0 1 9.99 1c2.34 0 4.47.89 6.07 2.36-.04 0-.08-.01-.12-.01-.88 0-1.51.77-1.51 1.6 0 .74.43 1.37.88 2.11.34.6.74 1.37.74 2.48 0 .77-.29 1.66-.69 2.91l-.89 3-3.23-9.66Zm3.28 11.98 2.75-7.94c.51-1.28.68-2.31.68-3.22 0-.33-.02-.64-.06-.93.7 1.28 1.1 2.75 1.1 4.31a8.99 8.99 0 0 1-4.47 7.78Z" fill="currentColor" /></svg>
              WordPress
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#18181b', fontFamily: F }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e5484d', flexShrink: 0 }} />
                Not connected to any WordPress site
              </div>
              <button type="button" onClick={() => router.push('/settings/wordpress')}
                style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#3f3f47', fontFamily: F, whiteSpace: 'nowrap' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#18181b'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#3f3f47'; }}>
                Manage
              </button>
            </div>
          </div>
        </div>

        <Divider />

        {/* Copy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 16px' }}>
          <SectionTitle>Copy</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <ExportCard icon={IcoContent} label="Content" onClick={() => copy(plainText, 'Content')} />
            <ExportCard icon={IcoHtml} label="HTML" onClick={() => copy(html, 'HTML')} />
            <ExportCard icon={IcoMd} label="Markdown" onClick={() => copy(htmlToMarkdown(html), 'Markdown')} />
          </div>
        </div>

        <Divider />

        {/* Download */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 16px' }}>
          <SectionTitle>Download</SectionTitle>
          <div style={{ display: 'flex', gap: 8 }}>
            <ExportCard icon={IcoHtml} label="HTML" onClick={() => download(`${fname}.html`, html, 'text/html')} />
            <ExportCard icon={IcoMd} label="Markdown" onClick={() => download(`${fname}.md`, htmlToMarkdown(html), 'text/markdown')} />
          </div>
        </div>

        <Divider />

        {/* Social media */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px' }}>
          <SectionTitle>Social media</SectionTitle>
          <span style={{ fontSize: 14, color: '#18181b', fontFamily: F }}>Create a social media post from your content</span>
          <button type="button" onClick={() => toast('Social media post — coming soon')}
            style={{ width: '100%', padding: '9px 16px', borderRadius: 6, border: 'none', boxShadow: 'inset 0 0 0 1px #e4e4e7', background: 'transparent', color: '#3f3f47', fontSize: 14, fontWeight: 600, fontFamily: F, cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f4f5'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            Create Social Media Post
          </button>
        </div>

        {/* Time to move on? */}
        {!isDone && doneCardOpen && (
          <div style={{ padding: '4px 16px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid #e4e4e7', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#18181b', fontFamily: F }}>Time to move on?</span>
                <button type="button" title="Dismiss" onClick={() => setDoneCardOpen(false)}
                  style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: '#3f3f47', display: 'inline-flex', lineHeight: 1 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#18181b'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#3f3f47'; }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
              <span style={{ fontSize: 14, color: '#18181b', fontFamily: F }}>Update the article status or keep going to complete the process</span>
              <button type="button" onClick={onMarkDone}
                style={{ alignSelf: 'flex-start', padding: '7px 16px', borderRadius: 6, border: 'none', background: '#f4f4f5', color: '#18181b', fontSize: 14, fontWeight: 600, fontFamily: F, cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e4e4e7'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#f4f4f5'; }}>
                Mark as done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublishExportPanel;
