import React, { useState } from 'react';
import Modal, { ModalBody, ModalHeader } from '../primitives/Modal';
import Button from '../primitives/Button';
import { Input } from '../primitives';
import { Form, FormField, FormSection, FormActions, FieldHint } from '../forms';
import { useConfirmMfa, useEnrollMfa } from '../../../services/accountSecurity';
import { Icon } from '../icons/Icon';

export type Enable2FADialogProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Enable 2FA — Figma `10018:306013`.
 * No fake success: enroll/confirm adapters stub → coming soon toast.
 */
export function Enable2FADialog({ open, onClose }: Enable2FADialogProps) {
  const enroll = useEnrollMfa();
  const confirm = useConfirmMfa();
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  const start = () => {
    enroll.mutate(undefined, {
      onSuccess: (res) => {
        setSecret(res.secret);
        setQr(res.qrDataUrl);
      },
    });
  };

  const enable = () => {
    confirm.mutate(code.trim(), {
      onSuccess: () => {
        setCode('');
        onClose();
      },
    });
  };

  return (
    <Modal open={open} onClose={onClose} aria-label="Enable Two-Factor Authentication">
      <ModalHeader>Enable Two-Factor Authentication</ModalHeader>
      <ModalBody>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            enable();
          }}
        >
          <FormSection title="Authenticator app">
            <FieldHint>
              Scan the QR code with your authenticator app, then enter the 6-digit code.
            </FieldHint>
            {!qr ? (
              <Button type="button" variant="secondary" size="sm" onClick={start} busy={enroll.isLoading}>
                Generate setup code
              </Button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="2FA QR code" width={160} height={160} />
                {secret ? (
                  <FormField label="Secret key">
                    <Input size="sm" readOnly value={secret} monospace />
                  </FormField>
                ) : null}
              </div>
            )}
            <FormField label="Verification code" required>
              <Input
                size="md"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                leadingItems={<Icon name="Lock" size={16} weight="bold" />}
              />
            </FormField>
          </FormSection>
          <FormActions>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" busy={confirm.isLoading} disabled={confirm.isLoading || code.length < 6}>
              Enable
            </Button>
          </FormActions>
        </Form>
      </ModalBody>
    </Modal>
  );
}

export default Enable2FADialog;
