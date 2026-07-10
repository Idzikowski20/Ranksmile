import { Button, Input, Modal, ModalBody, ModalFooter, Select } from '../core';
import { KEYWORD_OPERATOR_OPTIONS, type KeywordOperator } from '../../lib/performance/types';

type KeywordFilterModalProps = {
  mode: 'custom' | 'brand';
  onClose: () => void;
  keywordOperatorDraft: KeywordOperator;
  onKeywordOperatorDraftChange: (value: KeywordOperator) => void;
  keywordValueDraft: string;
  onKeywordValueDraftChange: (value: string) => void;
  brandKeywordDraft: string;
  onBrandKeywordDraftChange: (value: string) => void;
  onSubmit: () => void;
};

export default function KeywordFilterModal({
  mode,
  onClose,
  keywordOperatorDraft,
  onKeywordOperatorDraftChange,
  keywordValueDraft,
  onKeywordValueDraftChange,
  brandKeywordDraft,
  onBrandKeywordDraftChange,
  onSubmit,
}: KeywordFilterModalProps) {
  return (
    <Modal title={mode === 'custom' ? 'Custom keyword' : 'Manage branded keywords'} onClose={onClose} width={600}>
      <ModalBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'custom' ? (
            <div style={{ display: 'flex', width: '50%', minWidth: 180 }}>
              <Select size="sm" value={keywordOperatorDraft}
                onChange={(v) => onKeywordOperatorDraftChange(v as KeywordOperator)}
                options={KEYWORD_OPERATOR_OPTIONS} />
            </div>
          ) : null}
          <label style={{ fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>{mode === 'custom' ? 'Keyword' : 'Keywords'}</label>
          <Input size="sm" value={mode === 'custom' ? keywordValueDraft : brandKeywordDraft}
            onChange={(e) => { if (mode === 'custom') onKeywordValueDraftChange(e.target.value); else onBrandKeywordDraftChange(e.target.value); }}
            placeholder={mode === 'custom' ? '' : 'brand-1, brand-2'} />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="sm" disabled={mode === 'custom' ? !keywordValueDraft.trim() : !brandKeywordDraft.trim()} onClick={onSubmit}>Choose</Button>
      </ModalFooter>
    </Modal>
  );
}
