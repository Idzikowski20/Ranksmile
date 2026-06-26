import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useContentSettings, useUpdateContentSettings } from '../../services/contentSettings';

const font = 'var(--font-family-primary)';

interface Voice { id: string; name: string; description: string; isDefault: boolean; }

const InfoIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={{ flexShrink: 0, color: '#9F9FA9' }}>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0m-9-3.75h.008v.008H12z" />
  </svg>
);

const AddVoiceModal = ({ onSave, onClose }: { onSave: (v: { name: string; description: string; isDefault: boolean }) => void; onClose: () => void; }) => {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [focused, setFocused] = useState<string | null>(null);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const canSave = name.trim().length > 0 && text.trim().length > 0;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ width: 760, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 16, fontFamily: font, boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 12px' }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#18181B' }}>Add Custom Voice</span>
          <button type="button" aria-label="Close" onClick={onClose} style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', color: '#52525C' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '0 24px 8px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>Name</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Friendly expert tone"
              onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
              style={{ width: '100%', boxSizing: 'border-box', height: 44, padding: '0 14px', fontFamily: font, fontSize: 14, color: '#18181B', borderRadius: 8, border: `1px solid ${focused === 'name' ? '#AA93FD' : '#E4E4E7'}`, boxShadow: focused === 'name' ? '0 0 0 3px rgba(120,58,251,0.1)' : 'none', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>Reference text</label>
            <span style={{ fontSize: 13, color: '#52525C' }}>Paste content whose tone & style the AI should mirror, or describe the voice in your own words.</span>
            <textarea
              value={text} onChange={(e) => setText(e.target.value)} rows={12}
              onFocus={() => setFocused('text')} onBlur={() => setFocused(null)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontFamily: font, fontSize: 15, lineHeight: 1.6, color: '#18181B', borderRadius: 8, border: `1px solid ${focused === 'text' ? '#AA93FD' : '#E4E4E7'}`, boxShadow: focused === 'text' ? '0 0 0 3px rgba(120,58,251,0.1)' : 'none', outline: 'none', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 14, color: '#3F3F47' }}>{words} words</span>
              <span style={{ fontSize: 14, color: '#52525C' }}>The reference text should be at least 200 words long</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 24px 24px' }}>
          <button type="button" onClick={() => setIsDefault((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: font }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 18, height: 18, borderRadius: 5, background: isDefault ? '#18181B' : '#fff', border: isDefault ? 'none' : '1px solid #D4D4D8' }}>
              {isDefault && <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </span>
            <span style={{ fontSize: 14, color: '#3F3F47' }}>Set the voice as default</span>
            <InfoIcon />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: font, fontSize: 14, fontWeight: 600, color: '#18181B', background: '#F4F4F5' }}>Cancel</button>
            <button
              type="button" disabled={!canSave}
              onClick={() => onSave({ name: name.trim(), description: text.trim(), isDefault })}
              style={{ padding: '10px 20px', borderRadius: 10, border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: font, fontSize: 14, fontWeight: 600, color: '#fff', background: canSave ? '#18181B' : '#9F9FA9', opacity: canSave ? 1 : 0.6 }}
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CustomVoicesSettings = () => {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);

  const { data: contentSettings } = useContentSettings();
  const updateContentSettings = useUpdateContentSettings();
  const seeded = useRef(false);
  useEffect(() => {
    if (!contentSettings || seeded.current) return;
    seeded.current = true;
    setVoices(contentSettings.voices as Voice[]);
  }, [contentSettings]);

  const persist = async (next: Voice[]) => {
    setVoices(next);
    try {
      await updateContentSettings.mutateAsync({ voices: next });
    } catch { toast.error('Failed to save'); }
  };

  const addVoice = (v: { name: string; description: string; isDefault: boolean }) => {
    const id = `v_${Date.now()}`;
    let next = [...voices, { id, ...v }];
    if (v.isDefault) next = next.map((x) => ({ ...x, isDefault: x.id === id }));
    persist(next);
    setOpen(false);
    toast.success('Custom Voice saved');
  };

  const removeVoice = (id: string) => persist(voices.filter((v) => v.id !== id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', fontFamily: font }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button" onClick={() => setOpen(true)}
          onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: font, fontSize: 14, fontWeight: 600, color: '#fff', background: hover ? '#783AFB' : '#18181B', transition: 'background 150ms ease', whiteSpace: 'nowrap' }}
        >
          Add Custom Voice
        </button>
      </div>

      {voices.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%', padding: 16, borderRadius: 8, background: '#F8F8F9', fontSize: 14, color: '#3F3F47' }}>
          You haven&apos;t created any Custom Voice yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {voices.map((v) => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderRadius: 10, border: '1px solid #E4E4E7', background: '#fff' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B' }}>{v.name}</span>
                  {v.isDefault && <span style={{ fontSize: 11, fontWeight: 600, color: '#630DE3', background: 'rgba(120,58,251,0.1)', padding: '2px 8px', borderRadius: 9999 }}>Default</span>}
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#52525C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 520 }}>{v.description}</p>
              </div>
              <button type="button" aria-label="Delete" onClick={() => removeVoice(v.id)} style={{ flexShrink: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9F9FA9', display: 'inline-flex' }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M6 7h12M9 7V5h6v2M10 11v6M14 11v6M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {open && <AddVoiceModal onSave={addVoice} onClose={() => setOpen(false)} />}
    </div>
  );
};

export default CustomVoicesSettings;
