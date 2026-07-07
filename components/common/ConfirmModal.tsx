import React, { useEffect, useState } from 'react';
import Modal, { ModalBody, ModalFooter, ModalHeader } from '../core/modal/modal';
import Button from '../core/button/button';
import Input from '../core/input/input';
import { FormField } from '../core/form';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
  destructive?: boolean;
  confirmText?: string;
  confirmFieldLabel?: string;
  confirmHint?: string;
}

const ConfirmModal = ({
  open, title, message, confirmLabel, onConfirm, onClose, loading, destructive,
  confirmText, confirmFieldLabel, confirmHint,
}: ConfirmModalProps) => {
  const [typed, setTyped] = useState('');
  useEffect(() => { if (!open) setTyped(''); }, [open]);
  if (!open) return null;

  const canConfirm = !loading && (!confirmText || typed === confirmText);

  return (
    <Modal onClose={loading ? () => {} : onClose} width={480} closeOnOverlayClick={!loading}>
      <ModalHeader title={title} onClose={loading ? undefined : onClose} closeButton />
      <ModalBody>
        <p className="sentry-confirm-message">{message}</p>
        {confirmText && (
          <FormField
            label={confirmFieldLabel || <>Type <strong>{confirmText}</strong> to confirm</>}
            hint={confirmHint}
          >
            <Input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canConfirm) onConfirm(); }}
            />
          </FormField>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" disabled={loading} onClick={onClose}>Cancel</Button>
        <Button variant={destructive ? 'danger' : 'primary'} disabled={!canConfirm} busy={loading} onClick={onConfirm}>
          {loading ? 'Removing…' : confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default ConfirmModal;
