import React, { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Modal, ModalBody, ModalFooter, SearchBar } from '../../core';
import { MOCK_CATEGORIES } from '../../../lib/local/mockPlaces';

const FONT = 'var(--font-family-primary)';
const MAX_CATEGORIES = 10;

type ChooseCategoriesModalProps = {
  open: boolean;
  selected: string[];
  primary: string | null;
  onClose: () => void;
  onApply: (selected: string[], primary: string | null) => void;
};

export default function ChooseCategoriesModal({
  open,
  selected,
  primary,
  onClose,
  onApply,
}: ChooseCategoriesModalProps) {
  const [search, setSearch] = useState('');
  const [draftSelected, setDraftSelected] = useState<string[]>(selected);
  const [draftPrimary, setDraftPrimary] = useState<string | null>(primary);

  useEffect(() => {
    if (open) {
      setDraftSelected(selected);
      setDraftPrimary(primary);
      setSearch('');
    }
  }, [open, selected, primary]);

  const leafCategories = useMemo(
    () => MOCK_CATEGORIES.filter((c) => !c.group),
    [],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leafCategories;
    return leafCategories.filter((c) => c.label.toLowerCase().includes(q));
  }, [search, leafCategories]);

  const toggle = (label: string) => {
    setDraftSelected((prev) => {
      if (prev.includes(label)) {
        const next = prev.filter((x) => x !== label);
        if (draftPrimary === label) setDraftPrimary(next[0] ?? null);
        return next;
      }
      if (prev.length >= MAX_CATEGORIES) return prev;
      const next = [...prev, label];
      if (!draftPrimary) setDraftPrimary(label);
      return next;
    });
  };

  const setPrimary = (label: string) => {
    if (!draftSelected.includes(label)) {
      setDraftSelected((prev) => (prev.length >= MAX_CATEGORIES ? prev : [...prev, label]));
    }
    setDraftPrimary(label);
  };

  if (!open) return null;

  return (
    <Modal title="Choose categories" onClose={onClose} width={880}>
      <ModalBody>
        <div className="local-setup-categories-modal" style={{ fontFamily: FONT }}>
          <div className="local-setup-categories-left">
            <p className="local-setup-categories-desc">
              Your location is far more likely to be found by customers if you select the right
              category. You can select one primary category and up to 9 additional.
            </p>
            <SearchBar value={search} onChange={setSearch} placeholder="Search..." width="100%" />
            <div className="local-setup-categories-tree">
              {filtered.map((cat) => {
                const isOn = draftSelected.includes(cat.label);
                return (
                  <div key={cat.id} className="local-setup-category-row">
                    <label className="local-setup-category-check">
                      <Checkbox checked={isOn} onChange={() => toggle(cat.label)} size="sm" />
                      <span>{cat.label}</span>
                    </label>
                    {isOn && (
                      <button
                        type="button"
                        className="local-setup-set-primary"
                        onClick={() => setPrimary(cat.label)}
                      >
                        {draftPrimary === cat.label ? 'Primary' : 'Set as primary'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="local-setup-categories-right">
            <div className="local-setup-categories-selected-head">
              <h3>Your selections</h3>
              <span className="local-setup-categories-counter">
                {draftSelected.length}/{MAX_CATEGORIES}
              </span>
            </div>
            {draftSelected.length === 0 ? (
              <p className="local-setup-categories-empty">
                Select categories on the left, and you&apos;ll see them here.
              </p>
            ) : (
              <ul className="local-setup-categories-selected-list">
                {draftSelected.map((label) => (
                  <li key={label}>
                    {label}
                    {draftPrimary === label && (
                      <span className="local-setup-primary-badge">Primary</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          type="button"
          size="md"
          variant="primary"
          onClick={() => onApply(draftSelected, draftPrimary)}
        >
          Apply categories
        </Button>
        <Button type="button" size="md" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}
