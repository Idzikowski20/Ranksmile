import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../tokens/semantic';
import { typeface, textScale, fontWeight } from '../tokens/typography';
import { spacing } from '../tokens/spacing';
import Button from '../primitives/Button';
import Modal, { ModalBody, ModalFooter, ModalHeader } from '../primitives/Modal';

const Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
  padding: 40px 0;
  border: none;
  border-radius: 0;
  background: transparent;
  font-family: ${typeface.body};
`;

const CardTitle = styled.h3`
  margin: 0;
  font-size: ${textScale.base.fontSize};
  font-weight: ${fontWeight.bold};
  color: ${semantic.status.danger};
`;

const ActionRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${spacing.xl};
  flex-wrap: wrap;
`;

const ActionText = styled.div`
  flex: 1;
  min-width: 200px;
`;

const ActionTitle = styled.p`
  margin: 0 0 4px;
  font-size: ${textScale.sm.fontSize};
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
`;

const ActionDesc = styled.p`
  margin: 0;
  font-size: ${textScale.xs.fontSize};
  color: ${semantic.text.secondary};
  line-height: 18px;
`;

export type DangerCardProps = {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function DangerCard({ title = 'Danger Zone', children, className }: DangerCardProps) {
  return (
    <Card className={`koala-danger-card ${className ?? ''}`.trim()}>
      <CardTitle>{title}</CardTitle>
      {children}
    </Card>
  );
}

export type DangerActionProps = {
  title: React.ReactNode;
  description: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
  busy?: boolean;
};

export function DangerAction({ title, description, actionLabel, onAction, busy }: DangerActionProps) {
  return (
    <ActionRow className="koala-danger-action">
      <ActionText>
        <ActionTitle>{title}</ActionTitle>
        <ActionDesc>{description}</ActionDesc>
      </ActionText>
      <Button type="button" size="sm" variant="danger" onClick={onAction} busy={busy} disabled={busy}>
        {actionLabel}
      </Button>
    </ActionRow>
  );
}

export type DangerDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  busy?: boolean;
};

export function DangerDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
  busy,
}: DangerDialogProps) {
  return (
    <Modal open={open} onClose={onClose} aria-label={title}>
      <ModalHeader>{title}</ModalHeader>
      <ModalBody>{description}</ModalBody>
      <ModalFooter>
        <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" variant="danger" size="sm" onClick={onConfirm} busy={busy} disabled={busy}>
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
