import React, { useEffect, useMemo, useRef } from 'react';
import { Button } from '../../core';
import {
  IconArrowDown,
  IconChat,
  IconCheck,
  IconChevronRight,
  IconClose,
  IconEdit,
  IconPicture,
  IconPlus,
  IconTrash,
} from '../icons';
import {
  getPrimaryCategory,
  getSuggestedCategories,
  getSuggestedDescription,
  GROWTH_MIN_PHOTOS,
} from '../../../lib/local/growthActions';
import { formatGrowthActivityDate } from '../../../lib/local/growthActionsProgress';
import type { BusinessDetails, GrowthActionLogEntry } from '../../../lib/local/types';

export type TaskOutcome = 'accepted' | 'rejected';

export function GrowthTaskFeedback({
  outcome,
  phase,
}: {
  outcome: TaskOutcome;
  phase: 'feedback-in' | 'feedback-out';
}) {
  const accepted = outcome === 'accepted';
  return (
    <div
      className={`local-dashboard-growth-feedback local-dashboard-growth-feedback--${outcome} local-dashboard-growth-feedback--${phase}`}
      role="status"
      aria-live="polite"
    >
      {accepted ? (
        <IconCheck size={28} color="#1AB25E" />
      ) : (
        <IconClose size={28} color="#A1A1AA" />
      )}
      <span>{accepted ? 'Accepted changes' : 'Rejected changes'}</span>
    </div>
  );
}

export function GrowthTaskActions({
  onSave,
  onDismiss,
  onNext,
  saveLabel = 'Save',
  disabled = false,
  saveDisabled = false,
}: {
  onSave: () => void;
  onDismiss: () => void;
  onNext: () => void;
  saveLabel?: string;
  disabled?: boolean;
  saveDisabled?: boolean;
}) {
  return (
    <div className="local-dashboard-growth-task-actions">
      <Button type="button" size="md" variant="primary" onClick={onSave} style={{ minWidth: 148 }} disabled={disabled || saveDisabled}>
        {saveLabel}
      </Button>
      <div className="local-dashboard-growth-task-secondary">
        <Button type="button" size="md" variant="transparent" onClick={onDismiss} disabled={disabled}>
          Dismiss
        </Button>
        <span className="local-dashboard-divider" />
        <button type="button" className="local-dashboard-icon-btn" aria-label="Next task" onClick={onNext} disabled={disabled}>
          <IconChevronRight size={16} color="#52525C" />
        </button>
      </div>
    </div>
  );
}

export function CategoryTag({ label, primary }: { label: string; primary?: boolean }) {
  return (
    <div className="local-dashboard-growth-tag-row">
      <span className="local-dashboard-growth-tag">{label}</span>
      {primary && <span className="local-dashboard-growth-tag-badge">Primary</span>}
    </div>
  );
}

export function RemovableCategoryTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="local-dashboard-growth-tag-removable">
      <span>{label}</span>
      <button type="button" aria-label={`Remove ${label}`} onClick={onRemove}>
        <IconClose size={14} color="#52525C" />
      </button>
    </span>
  );
}

export function AddCategoriesTask({
  details,
  onSave,
  onDismiss,
  onNext,
  actionsDisabled = false,
}: {
  details: BusinessDetails;
  onSave: (extraCategories: string[]) => void;
  onDismiss: () => void;
  onNext: () => void;
  actionsDisabled?: boolean;
}) {
  const primary = getPrimaryCategory(details);
  const initialSuggested = useMemo(() => getSuggestedCategories(details), [details]);
  const [suggested, setSuggested] = React.useState<string[]>(initialSuggested);

  useEffect(() => {
    setSuggested(initialSuggested);
  }, [initialSuggested]);

  const removeCategory = (label: string) => {
    setSuggested((prev) => prev.filter((cat) => cat !== label));
  };

  return (
    <>
      <div className="local-dashboard-growth-task-body">
        <div className="local-dashboard-growth-field-group">
          <span className="local-dashboard-growth-field-label">Current</span>
          <CategoryTag label={primary} primary />
        </div>
        <div className="local-dashboard-growth-arrow">
          <IconArrowDown size={16} color="#D4D4D8" />
        </div>
        <div className="local-dashboard-growth-field-group">
          <span className="local-dashboard-growth-field-label">Suggested</span>
          <CategoryTag label={primary} primary />
          <div className="local-dashboard-growth-tag-list">
            {suggested.map((cat) => (
              <RemovableCategoryTag key={cat} label={cat} onRemove={() => removeCategory(cat)} />
            ))}
          </div>
        </div>
      </div>
      <GrowthTaskActions
        onSave={() => onSave(suggested)}
        onDismiss={onDismiss}
        onNext={onNext}
        disabled={actionsDisabled}
      />
    </>
  );
}

export function ImproveDescriptionTask({
  details,
  onSave,
  onDismiss,
  onNext,
  actionsDisabled = false,
}: {
  details: BusinessDetails;
  onSave: (description: string) => void;
  onDismiss: () => void;
  onNext: () => void;
  actionsDisabled?: boolean;
}) {
  const suggestedText = useMemo(() => getSuggestedDescription(details), [details]);
  const [draft, setDraft] = React.useState(suggestedText);

  useEffect(() => {
    setDraft(suggestedText);
  }, [suggestedText]);

  return (
    <>
      <div className="local-dashboard-growth-task-body">
        <div className="local-dashboard-growth-field-group">
          <span className="local-dashboard-growth-field-label">Current</span>
          <textarea
            className="local-dashboard-growth-textarea local-dashboard-growth-textarea--readonly"
            rows={3}
            readOnly
            tabIndex={-1}
            value={details.description || 'No description yet.'}
          />
        </div>
        <div className="local-dashboard-growth-arrow">
          <IconArrowDown size={16} color="#D4D4D8" />
        </div>
        <div className="local-dashboard-growth-field-group">
          <span className="local-dashboard-growth-field-label">Suggested</span>
          <textarea
            className="local-dashboard-growth-textarea"
            rows={4}
            maxLength={750}
            placeholder="Describe the services your business provides"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
      </div>
      <GrowthTaskActions
        onSave={() => {
          const next = draft.trim();
          if (next) onSave(next);
        }}
        onDismiss={onDismiss}
        onNext={onNext}
        disabled={actionsDisabled}
      />
    </>
  );
}

export function SetupAgentTask({
  onAccept,
  onDismiss,
  onNext,
  actionsDisabled = false,
}: {
  onAccept: () => void;
  onDismiss: () => void;
  onNext: () => void;
  actionsDisabled?: boolean;
}) {
  return (
    <>
      <div className="local-dashboard-growth-task-body">
        <ul className="local-dashboard-growth-agent-list">
          <li><IconEdit size={16} color="#783AFB" /> Generates and publishes posts</li>
          <li><IconChat size={16} color="#783AFB" /> Replies to reviews</li>
          <li><IconPicture size={16} color="#783AFB" /> Updates business photos</li>
        </ul>
      </div>
      <div className="local-dashboard-growth-task-actions">
        <Button
          type="button"
          size="md"
          variant="primary"
          disabled={actionsDisabled}
          onClick={onAccept}
        >
          Set up AI Agent
        </Button>
        <div className="local-dashboard-growth-task-secondary">
          <Button type="button" size="md" variant="transparent" onClick={onDismiss} disabled={actionsDisabled}>
            Dismiss
          </Button>
          <span className="local-dashboard-divider" />
          <button
            type="button"
            className="local-dashboard-icon-btn"
            aria-label="Next task"
            onClick={onNext}
            disabled={actionsDisabled}
          >
            <IconChevronRight size={16} color="#52525C" />
          </button>
        </div>
      </div>
    </>
  );
}

type LogoPhase = 'searching' | 'upload';

function LogoLookingSpinner() {
  return (
    <div className="local-dashboard-growth-logo-spin" aria-hidden="true">
      <span className="local-dashboard-growth-logo-spin-ring local-dashboard-growth-logo-spin-ring--a" />
      <span className="local-dashboard-growth-logo-spin-ring local-dashboard-growth-logo-spin-ring--b" />
      <span className="local-dashboard-growth-logo-spin-ring local-dashboard-growth-logo-spin-ring--c" />
    </div>
  );
}

export function AddLogoTask({
  onSave,
  onDismiss,
  onNext,
  actionsDisabled = false,
}: {
  onSave: (logoUrl: string) => void;
  onDismiss: () => void;
  onNext: () => void;
  actionsDisabled?: boolean;
}) {
  const [phase, setPhase] = React.useState<LogoPhase>('searching');
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setPhase('upload'), 2200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const onPickFile = (file: File | null) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|jpg)$/i.test(file.type) && !/\.(jpe?g|png)$/i.test(file.name)) return;
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  return (
    <>
      <div className="local-dashboard-growth-task-body">
        {phase === 'searching' ? (
          <div className="local-dashboard-growth-logo-looking" data-testid="spin-loading-state">
            <LogoLookingSpinner />
            <span>Looking for your logo...</span>
          </div>
        ) : (
          <button
            type="button"
            className={`local-dashboard-growth-logo-dropzone${previewUrl ? ' local-dashboard-growth-logo-dropzone--filled' : ''}`}
            aria-label="Add photo"
            disabled={actionsDisabled}
            onClick={() => inputRef.current?.click()}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Selected logo preview" className="local-dashboard-growth-logo-preview" />
            ) : (
              <span className="local-dashboard-growth-logo-plus" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M13 5a1 1 0 1 0-2 0v6H5a1 1 0 1 0 0 2h6v6a1 1 0 1 0 2 0v-6h6a1 1 0 1 0 0-2h-6V5Z" fill="currentColor" />
                </svg>
              </span>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              hidden
              onChange={(e) => {
                onPickFile(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
          </button>
        )}
      </div>
      <GrowthTaskActions
        onSave={() => {
          if (previewUrl) onSave(previewUrl);
        }}
        onDismiss={onDismiss}
        onNext={onNext}
        disabled={actionsDisabled}
        saveDisabled={phase === 'searching' || !previewUrl}
      />
    </>
  );
}

export function AddCoverPhotoTask({
  onSave,
  onDismiss,
  onNext,
  actionsDisabled = false,
}: {
  onSave: (coverUrl: string) => void;
  onDismiss: () => void;
  onNext: () => void;
  actionsDisabled?: boolean;
}) {
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const onPickFile = (file: File | null) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|jpg)$/i.test(file.type) && !/\.(jpe?g|png)$/i.test(file.name)) return;
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  return (
    <>
      <div className="local-dashboard-growth-task-body">
        <button
          type="button"
          className={`local-dashboard-growth-logo-dropzone${previewUrl ? ' local-dashboard-growth-logo-dropzone--filled' : ''}`}
          aria-label="Add photo"
          disabled={actionsDisabled}
          onClick={() => inputRef.current?.click()}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Selected cover photo preview" className="local-dashboard-growth-logo-preview" />
          ) : (
            <span className="local-dashboard-growth-logo-plus" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M13 5a1 1 0 1 0-2 0v6H5a1 1 0 1 0 0 2h6v6a1 1 0 1 0 2 0v-6h6a1 1 0 1 0 0-2h-6V5Z" fill="currentColor" />
              </svg>
            </span>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            hidden
            onChange={(e) => {
              onPickFile(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
        </button>
      </div>
      <GrowthTaskActions
        onSave={() => {
          if (previewUrl) onSave(previewUrl);
        }}
        onDismiss={onDismiss}
        onNext={onNext}
        disabled={actionsDisabled}
        saveDisabled={!previewUrl}
      />
    </>
  );
}

function isImageFile(file: File): boolean {
  return /^image\/(jpeg|png|jpg)$/i.test(file.type) || /\.(jpe?g|png)$/i.test(file.name);
}

function revokeBlobUrl(url: string) {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url);
}

export function AddPhotosTask({
  details,
  onSave,
  onDismiss,
  onNext,
  actionsDisabled = false,
}: {
  details: BusinessDetails;
  onSave: (photoUrls: string[]) => void;
  onDismiss: () => void;
  onNext: () => void;
  actionsDisabled?: boolean;
}) {
  const [photos, setPhotos] = React.useState<string[]>(() => details.photoUrls.filter((url) => url.trim()));
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceIndexRef = useRef<number | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => () => {
    photosRef.current.forEach(revokeBlobUrl);
  }, []);

  const appendFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const nextUrls: string[] = [];
    Array.from(fileList).forEach((file) => {
      if (isImageFile(file)) nextUrls.push(URL.createObjectURL(file));
    });
    if (nextUrls.length === 0) return;
    setPhotos((prev) => [...prev, ...nextUrls]);
  };

  const replaceAt = (index: number, file: File | null) => {
    if (!file || !isImageFile(file)) return;
    const nextUrl = URL.createObjectURL(file);
    setPhotos((prev) => {
      const copy = [...prev];
      const previous = copy[index];
      if (previous) revokeBlobUrl(previous);
      copy[index] = nextUrl;
      return copy;
    });
  };

  const removeAt = (index: number) => {
    setPhotos((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(index, 1);
      if (removed) revokeBlobUrl(removed);
      return copy;
    });
  };

  return (
    <>
      <div className="local-dashboard-growth-task-body local-dashboard-growth-photos">
        <button
          type="button"
          className="local-dashboard-growth-photos-add"
          disabled={actionsDisabled}
          onClick={() => addInputRef.current?.click()}
        >
          <IconPlus size={16} color="currentColor" />
          <span>Add photos</span>
        </button>
        <input
          ref={addInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          multiple
          hidden
          onChange={(e) => {
            appendFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={replaceInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          hidden
          onChange={(e) => {
            const index = replaceIndexRef.current;
            replaceIndexRef.current = null;
            if (index != null) replaceAt(index, e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
        {photos.length > 0 && (
          <div className="local-dashboard-growth-photos-grid">
            {photos.map((url, index) => (
              <div key={`${url}-${index}`} className="local-dashboard-growth-photos-thumb" aria-label="Uploaded picture">
                <img src={url} alt="" width={140} height={140} />
                <div className="local-dashboard-growth-photos-actions">
                  <button
                    type="button"
                    className="local-dashboard-growth-photos-action"
                    aria-label="Edit photo"
                    disabled={actionsDisabled}
                    onClick={() => {
                      replaceIndexRef.current = index;
                      replaceInputRef.current?.click();
                    }}
                  >
                    <IconEdit size={16} color="#FFFFFF" />
                  </button>
                  <button
                    type="button"
                    className="local-dashboard-growth-photos-action"
                    aria-label="Delete photo"
                    disabled={actionsDisabled}
                    onClick={() => removeAt(index)}
                  >
                    <IconTrash size={16} color="#FFFFFF" />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="local-dashboard-growth-photos-tile-add"
              aria-label="Add photo"
              disabled={actionsDisabled}
              onClick={() => addInputRef.current?.click()}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M13 5a1 1 0 1 0-2 0v6H5a1 1 0 1 0 0 2h6v6a1 1 0 1 0 2 0v-6h6a1 1 0 1 0 0-2h-6V5Z" fill="currentColor" />
              </svg>
            </button>
          </div>
        )}
      </div>
      <GrowthTaskActions
        onSave={() => {
          if (photos.length >= GROWTH_MIN_PHOTOS) onSave(photos);
        }}
        onDismiss={onDismiss}
        onNext={onNext}
        disabled={actionsDisabled}
        saveDisabled={photos.length < GROWTH_MIN_PHOTOS}
      />
    </>
  );
}

export function GrowthActivityList({
  entries,
  locationCreatedAt,
}: {
  entries: GrowthActionLogEntry[];
  locationCreatedAt: string | null;
}) {
  const visible = entries.slice(0, 2);
  const hiddenCount = Math.max(0, entries.length - visible.length);

  return (
    <div className="local-dashboard-growth-activity-list">
      {visible.map((entry) => (
        <div key={entry.key} className="local-dashboard-growth-activity-row">
          <div className="local-dashboard-growth-activity-item">
            <IconCheck size={16} color="#1AB25E" />
            <span className="local-dashboard-growth-activity-done">{entry.title}</span>
          </div>
          <span className="local-dashboard-activity-time">
            {formatGrowthActivityDate(
              entry.key === 'location-created' ? locationCreatedAt : entry.completedAt,
            )}
          </span>
        </div>
      ))}
      {hiddenCount > 0 && (
        <div className="local-dashboard-growth-activity-row local-dashboard-growth-activity-row--more">
          <div className="local-dashboard-growth-activity-item">
            <IconCheck size={16} color="#1AB25E" />
            <span className="local-dashboard-growth-activity-done">
              +
              {hiddenCount}
              {' '}
              more
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

