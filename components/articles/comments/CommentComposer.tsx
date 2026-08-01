import React, { useEffect, useRef, useState } from 'react';
import { Button, Textarea } from '../../koala/core';

const F = 'var(--font-family-primary)';
const EMOJIS = ['👍', '👎', '❤️', '🔥', '😀', '😍', '🎉', '✅', '🙌', '👀', '💡', '🚀'];

export type DraftComment = { text: string; images: string[] };

const IcoEmoji = () => (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></svg>
);
const IcoAt = () => (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" /></svg>
);
const IcoImage = () => (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="1.6" /><path d="m21 15-4.5-4.5L5 21" /></svg>
);

interface Props {
  authorName: string;
  authorColor: string;
  authorAvatar?: string;
  autoFocus?: boolean;
  onSubmit: (c: DraftComment) => void;
  onCancel?: () => void;
}

/** Figma-style dark comment composer: avatar pin + textarea + emoji/@/image + send. */
const CommentComposer = ({ authorName, authorColor, authorAvatar, autoFocus, onSubmit, onCancel }: Props) => {
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (autoFocus) taRef.current?.focus(); }, [autoFocus]);

  // "@word" at the caret → show a (demo) mention dropdown.
  const mentionMatch = /(^|\s)@(\w*)$/.exec(text.slice(0, taRef.current?.selectionStart ?? text.length));
  const mentionQuery = mentionMatch ? mentionMatch[2] : null;

  const addImages = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 4).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => setImages((prev) => [...prev, String(reader.result)]);
      reader.readAsDataURL(f);
    });
  };

  const submit = () => {
    if (!text.trim() && images.length === 0) return;
    onSubmit({ text: text.trim(), images });
    setText(''); setImages([]); setEmojiOpen(false);
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 10, fontFamily: F }}>
      {/* avatar teardrop pin */}
      <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50% 50% 50% 3px', background: '#18181b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, boxShadow: '0 2px 6px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {authorAvatar
          ? <img alt={authorName} src={authorAvatar} referrerPolicy="no-referrer" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
          : authorName.charAt(0).toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: 0, background: '#2b2b30', borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        <Textarea
          ref={taRef}
          value={text}
          rows={1}
          placeholder="Add a comment…"
          className="styled-scrollbar-dark"
          resize="none"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            minHeight: 44,
            maxHeight: 160,
            padding: '12px 14px',
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: 15,
            fontFamily: F,
            lineHeight: '20px',
          }}
        />
        {images.length > 0 && (
          <div style={{ display: 'flex', gap: 8, padding: '0 14px 10px', flexWrap: 'wrap' }}>
            {images.map((src, i) => (
              <div key={i} style={{ position: 'relative', width: 56, height: 56, borderRadius: 8, overflow: 'hidden', background: '#3a3a40' }}>
                <img alt="" src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <Button
                  type="button"
                  variant="transparent"
                  size="zero"
                  onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, minHeight: 16, minWidth: 16, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, lineHeight: '16px', padding: 0 }}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderTop: '1px solid #3a3a40' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button type="button" variant="transparent" size="sm" title="Emoji" onClick={() => setEmojiOpen((v) => !v)} icon={<IcoEmoji />} />
            <Button type="button" variant="transparent" size="sm" title="Mention" onClick={() => setText((t) => `${t}@`)} icon={<IcoAt />} />
            <Button type="button" variant="transparent" size="sm" title="Attach image" onClick={() => fileRef.current?.click()} icon={<IcoImage />} />
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addImages(e.target.files)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {onCancel && (
              <Button type="button" variant="transparent" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={submit}
              aria-label="Send"
              disabled={!text.trim() && images.length === 0}
              style={{
                width: 32,
                minWidth: 32,
                height: 32,
                minHeight: 32,
                borderRadius: '50%',
                padding: 0,
                ...((!text.trim() && images.length === 0) ? { opacity: 0.6 } : {}),
              }}
              icon={(
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
              )}
            />
          </div>
        </div>

        {emojiOpen && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 10px', borderTop: '1px solid #3a3a40' }}>
            {EMOJIS.map((e) => (
              <Button
                key={e}
                type="button"
                variant="transparent"
                size="sm"
                onClick={() => { setText((t) => t + e); setEmojiOpen(false); taRef.current?.focus(); }}
                style={{ width: 30, minWidth: 30, height: 30, minHeight: 30, fontSize: 18, padding: 0 }}
              >
                {e}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* @mention demo dropdown */}
      {mentionQuery !== null && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 40, right: 0, background: '#2b2b30', borderRadius: 10, padding: '12px 14px', color: '#a1a1aa', fontSize: 14, boxShadow: '0 8px 28px rgba(0,0,0,0.3)' }}>
          No matches for @{mentionQuery}
        </div>
      )}
    </div>
  );
};

export default CommentComposer;
