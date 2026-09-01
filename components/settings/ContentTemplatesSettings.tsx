import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useContentSettings, useUpdateContentSettings } from '../../services/contentSettings';
import { Button, Input, Textarea, Checkbox, Badge } from '../koala/core';
import Modal, { ModalBody, ModalFooter } from '../koala/core/modal/modal';
import {
  KoalaPanel,
  KoalaEmptyState,
} from '../koala/layout';

interface Template { id: string; name: string; referenceText: string; isDefault: boolean; }

const AddTemplateModal = ({ onSave, onClose }: { onSave: (t: { name: string; referenceText: string; isDefault: boolean }) => void; onClose: () => void; }) => {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const canSave = name.trim().length > 0 && text.trim().length > 0;

  return (
    <Modal title="Add Content Template" onClose={onClose} width={760}>
      <ModalBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--koala-text-primary)', fontFamily: 'var(--font-family-primary)' }}>Name</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. How-to guide structure"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--koala-text-primary)', fontFamily: 'var(--font-family-primary)' }}>Reference content</label>
            <span style={{ fontSize: 13, color: 'var(--koala-text-secondary)', fontFamily: 'var(--font-family-primary)' }}>
              Paste reusable content whose structure and format the AI should follow, or describe the layout in your own words.
            </span>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} style={{ width: '100%' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 14, color: 'var(--koala-text-primary)', fontFamily: 'var(--font-family-primary)' }}>{words} words</span>
              <span style={{ fontSize: 14, color: 'var(--koala-text-secondary)', fontFamily: 'var(--font-family-primary)' }}>The reference content should be at least 200 words long</span>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--font-family-primary)' }}>
            <Checkbox checked={isDefault} onChange={setIsDefault} />
            <span style={{ fontSize: 14, color: 'var(--koala-text-primary)' }}>Set the template as default</span>
          </label>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="button" variant="primary" disabled={!canSave} onClick={() => onSave({ name: name.trim(), referenceText: text.trim(), isDefault })}>
          Save changes
        </Button>
      </ModalFooter>
    </Modal>
  );
};

const ContentTemplatesSettings = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);

  const { data: contentSettings } = useContentSettings();
  const updateContentSettings = useUpdateContentSettings();
  const seeded = useRef(false);
  useEffect(() => {
    if (!contentSettings || seeded.current) return;
    seeded.current = true;
    setTemplates(contentSettings.templates as Template[]);
  }, [contentSettings]);

  const persist = async (next: Template[]) => {
    setTemplates(next);
    try {
      await updateContentSettings.mutateAsync({ templates: next });
    } catch { toast.error('Failed to save'); }
  };

  const addTemplate = (t: { name: string; referenceText: string; isDefault: boolean }) => {
    const id = `t_${Date.now()}`;
    let next = [...templates, { id, ...t }];
    if (t.isDefault) next = next.map((x) => ({ ...x, isDefault: x.id === id }));
    persist(next);
    setOpen(false);
    toast.success('Content Template saved');
  };

  const removeTemplate = (id: string) => persist(templates.filter((t) => t.id !== id));

  return (
    <>
      {templates.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
            Add content template
          </Button>
        </div>
      )}

      {templates.length === 0 ? (
        <KoalaEmptyState
          title="No content templates yet"
          description="You haven't created any content template yet."
          actions={(
            <Button type="button" variant="primary" onClick={() => setOpen(true)}>
              Add content template
            </Button>
          )}
        />
      ) : (
        <KoalaPanel noPadding>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
            {templates.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '14px 16px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--koala-text-primary)', fontFamily: 'var(--font-family-primary)' }}>{t.name}</span>
                    {t.isDefault && (
                      <Badge appearance="brand" size="sm">Default</Badge>
                    )}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--koala-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 520, fontFamily: 'var(--font-family-primary)' }}>
                    {t.referenceText}
                  </p>
                </div>
                <Button type="button" variant="transparent" size="sm" aria-label="Delete" onClick={() => removeTemplate(t.id)}>
                  Delete
                </Button>
              </div>
            ))}
            </div>
        </KoalaPanel>
      )}

      {open && <AddTemplateModal onSave={addTemplate} onClose={() => setOpen(false)} />}
    </>
  );
};

export default ContentTemplatesSettings;
