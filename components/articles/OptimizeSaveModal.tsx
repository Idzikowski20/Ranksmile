import React from 'react';
import Modal, { ModalBody, ModalFooter, ModalHeader } from '../core/modal/modal';
import Button from '../core/button/button';

// AO-8a: confirmation modal shown when the user clicks Save on an Auto-Optimize
// review. Mirrors OptimizeCancelModal structurally (420px card, growOut, same
// shadow/radius/fonts) — see design.md §16.

export interface OptimizeSaveModalProps {
   open: boolean;
   /** Closes the modal and stays in review. */
   onContinueEditing: () => void;
   /** Applies all undenied changes and persists the article. */
   onSave: () => void;
   saving?: boolean;
}

const OptimizeSaveModal: React.FC<OptimizeSaveModalProps> = ({ open, onContinueEditing, onSave, saving }) => {
   if (!open) return null;

   return (
      <Modal onClose={saving ? () => {} : onContinueEditing} width={420} closeOnOverlayClick={!saving}>
         <ModalHeader title="Save changes?" closeButton={false} />
         <ModalBody>
            <p style={{ margin: 0 }}>
               Any changes you haven&apos;t rejected will be applied to your article.
            </p>
         </ModalBody>
         <ModalFooter>
            <Button variant="secondary" disabled={saving} onClick={onContinueEditing}>
               Continue editing
            </Button>
            <Button variant="primary" onClick={onSave} disabled={saving} busy={saving}>
               {saving ? 'Saving…' : 'Save'}
            </Button>
         </ModalFooter>
      </Modal>
   );
};

export default OptimizeSaveModal;
