import React, { useState } from 'react';
import { Modal, ModalBody, ModalFooter, FormField, Textarea, Button } from '../koala/core';

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (keywords: string[]) => void;
  loading?: boolean;
};

export default function AddKeywordsModal({ open, onClose, onAdd, loading }: Props) {
  const [text, setText] = useState('');

  if (!open) return null;

  const keywords = text.split(/[\n,]/).map((k) => k.trim()).filter(Boolean);
  const canSubmit = keywords.length > 0 && !loading;

  const submit = () => {
    if (!canSubmit) return;
    onAdd(keywords);
    setText('');
    onClose();
  };

  return (
    <Modal title="Add keywords" onClose={onClose} width={560}>
      <ModalBody>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#6A6772' }}>
          Paste keywords you want to track — one per line or comma-separated. We&apos;ll check their Google positions for this domain.
        </p>
        <FormField label="Keywords" hint="Up to 1,000 keywords per project">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'best crm software\nhow to choose crm\ncrm for small business'}
            rows={8}
            autoFocus
          />
        </FormField>
      </ModalBody>
      <ModalFooter>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
          <Button type="button" variant="transparent" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="primary" onClick={submit} disabled={!canSubmit} busy={loading}>
            {loading ? 'Adding…' : 'Add keywords'}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
