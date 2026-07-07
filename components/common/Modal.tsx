import React from 'react';
import Modal, { ModalBody } from '../core/modal/modal';

type ModalProps = {
   children: React.ReactNode;
   maxWidth?: number;
   title?: string;
   verticalCenter?: boolean;
   closeModal: () => void;
};

const LegacyModal = ({ children, maxWidth = 420, closeModal, title }: ModalProps) => (
   <Modal title={title} onClose={closeModal} width={maxWidth}>
      <ModalBody>{children}</ModalBody>
   </Modal>
);

export default LegacyModal;
