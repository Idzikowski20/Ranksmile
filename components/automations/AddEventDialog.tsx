import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Modal, { ModalBody, ModalFooter } from '../koala/core/modal/modal';
import { Button, Input, Select, Alert } from '../koala/core';
import { Form, FormField, FormSection, FieldHint } from '../koala/forms';
import type { AutomationPublishMode } from '../../lib/types/automations';

export type AddEventDialogProps = {
  open: boolean;
  onClose: () => void;
  dateLabel: string;
  scheduledDate: string;
  wordpressConnected: boolean;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (payload: {
    title: string;
    targetKeyword: string;
    publishMode: AutomationPublishMode;
  }) => void;
};

const PUBLISH_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'live', label: 'Live' },
];

/**
 * Add automation event — adapted from Koala Create Project dialog (Figma `5874:190606`).
 */
export default function AddEventDialog({
  open,
  onClose,
  dateLabel,
  scheduledDate,
  wordpressConnected,
  submitting = false,
  error = null,
  onSubmit,
}: AddEventDialogProps) {
  const [title, setTitle] = useState('');
  const [keyword, setKeyword] = useState('');
  const [publishMode, setPublishMode] = useState<AutomationPublishMode>('draft');

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setKeyword('');
    setPublishMode('draft');
  }, [open, scheduledDate]);

  if (!open) return null;

  const canSubmit = wordpressConnected && title.trim().length > 0 && !submitting;

  return (
    <Modal title="Add New Automation Event" onClose={onClose} width={520}>
      <ModalBody>
        {!wordpressConnected ? (
          <Alert variant="error" title="WordPress not connected">
            Connect WordPress in Settings before scheduling publish events.{' '}
            <Link href="/settings/wordpress" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
              Open WordPress settings
            </Link>
          </Alert>
        ) : (
          <Form
            id="add-automation-event"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSubmit) return;
              onSubmit({
                title: title.trim(),
                targetKeyword: keyword.trim(),
                publishMode,
              });
            }}
          >
            <FormSection
              title="Basic setup"
              description={`Schedule for ${dateLabel}. Creates a draft article you can edit before publish.`}
            >
              <FormField label="Article title" required>
                <Input
                  size="md"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. How to improve local SEO"
                  autoFocus
                />
              </FormField>
              <FormField label="Main keyword" required>
                <Input
                  size="md"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g. local seo tips"
                />
                <FieldHint>Primary keyword for the scheduled article.</FieldHint>
              </FormField>
              <FormField label="Publication option" required>
                <div style={{ width: '100%' }}>
                  <Select
                    options={PUBLISH_OPTIONS}
                    value={publishMode}
                    onChange={(v) => setPublishMode(v === 'live' ? 'live' : 'draft')}
                    size="md"
                    width="100%"
                  />
                </div>
                <FieldHint>
                  {publishMode === 'live'
                    ? 'Intended to publish live to WordPress on the scheduled day.'
                    : 'Keep as draft in WordPress when published.'}
                </FieldHint>
              </FormField>
            </FormSection>
            {error ? <Alert variant="error" title="Could not create event">{error}</Alert> : null}
          </Form>
        )}
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        {wordpressConnected ? (
          <Button
            type="submit"
            form="add-automation-event"
            variant="primary"
            size="md"
            disabled={!canSubmit || !keyword.trim()}
          >
            {submitting ? 'Creating…' : 'Create event'}
          </Button>
        ) : (
          <Button type="button" variant="primary" size="md" onClick={() => { window.location.href = '/settings/wordpress'; }}>
            Connect WordPress
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
