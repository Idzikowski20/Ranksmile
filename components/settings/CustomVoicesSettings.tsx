import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useContentSettings, useUpdateContentSettings } from '../../services/contentSettings';
import { Button, Input, Textarea, Checkbox } from '../core';
import Modal, { ModalBody, ModalFooter } from '../core/modal/modal';
import {
  SentrySettingsSection,
  SentrySettingsRow,
  SentryPanel,
  SentryEmptyState,
} from '../sentry-pages';

interface Voice { id: string; name: string; description: string; isDefault: boolean; }

const AddVoiceModal = ({ onSave, onClose }: { onSave: (v: { name: string; description: string; isDefault: boolean }) => void; onClose: () => void; }) => {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const canSave = name.trim().length > 0 && text.trim().length > 0;

  return (
    <Modal title="Add Custom Voice" onClose={onClose} width={760}>
      <ModalBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Name</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Friendly expert tone"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>Reference text</label>
            <span style={{ fontSize: 13, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
              Paste content whose tone and style the AI should mirror, or describe the voice in your own words.
            </span>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} style={{ width: '100%' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 14, color: '#3F3F47', fontFamily: 'var(--font-family-primary)' }}>{words} words</span>
              <span style={{ fontSize: 14, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>The reference text should be at least 200 words long</span>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--font-family-primary)' }}>
            <Checkbox checked={isDefault} onChange={setIsDefault} />
            <span style={{ fontSize: 14, color: '#3F3F47' }}>Set the voice as default</span>
          </label>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="button" variant="primary" disabled={!canSave} onClick={() => onSave({ name: name.trim(), description: text.trim(), isDefault })}>
          Save changes
        </Button>
      </ModalFooter>
    </Modal>
  );
};

const CustomVoicesSettings = () => {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [open, setOpen] = useState(false);

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
    <>
      <SentrySettingsSection title="Custom voices">
        <SentrySettingsRow
          label="Voice library"
          description="Manage custom voices used in Content Editor, Humanizer, and Surfer AI."
        >
          <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
            Add custom voice
          </Button>
        </SentrySettingsRow>
      </SentrySettingsSection>

      {voices.length === 0 ? (
        <SentryEmptyState
          title="No custom voices yet"
          description="You haven't created any custom voice yet."
          actions={(
            <Button type="button" variant="primary" onClick={() => setOpen(true)}>
              Add custom voice
            </Button>
          )}
        />
      ) : (
        <SentryPanel noPadding>
            {voices.map((v, i) => (
              <div
                key={v.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '14px 16px',
                  borderTop: i === 0 ? undefined : '1px solid #E4E4E7',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}>{v.name}</span>
                    {v.isDefault && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#630DE3', background: 'rgba(120,58,251,0.1)', padding: '2px 8px', borderRadius: 9999 }}>
                        Default
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#52525C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 520, fontFamily: 'var(--font-family-primary)' }}>
                    {v.description}
                  </p>
                </div>
                <Button type="button" variant="transparent" size="sm" aria-label="Delete" onClick={() => removeVoice(v.id)}>
                  Delete
                </Button>
              </div>
            ))}
        </SentryPanel>
      )}

      {open && <AddVoiceModal onSave={addVoice} onClose={() => setOpen(false)} />}
    </>
  );
};

export default CustomVoicesSettings;
