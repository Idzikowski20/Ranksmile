import React from 'react';
import Modal, { ModalBody, ModalFooter, ModalHeader } from '../core/modal/modal';
import Button from '../core/button/button';

// AO-8a: confirmation modal shown when the user cancels an Auto-Optimize review.
// Cancelling discards every suggested change and restores the pre-optimize article,
// so we gate it behind an explicit confirm. Centered card over a scrim (design.md §16).

export interface OptimizeCancelModalProps {
   open: boolean;
   /** Closes the modal and stays in review. */
   onGoBack: () => void;
   /** Discards all suggestions and restores the pre-optimize article. */
   onConfirm: () => void;
}

const OptimizeCancelModal: React.FC<OptimizeCancelModalProps> = ({ open, onGoBack, onConfirm }) => {
   if (!open) return null;

   return (
      <Modal onClose={onGoBack} width={420}>
         <ModalHeader title="Cancel Auto-Optimize?" closeButton={false} />
         <ModalBody>
            <p style={{ margin: 0 }}>
               All suggested changes will be discarded and the article restored to its pre-optimize state. This can’t be undone.
            </p>
         </ModalBody>
         <ModalFooter>
            <Button variant="secondary" onClick={onGoBack}>
               Go back
            </Button>
            <Button variant="danger" onClick={onConfirm}>
               Confirm cancel
            </Button>
         </ModalFooter>
      </Modal>
   );
};

export default OptimizeCancelModal;
