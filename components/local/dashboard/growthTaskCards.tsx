import React, { useEffect, useMemo } from 'react';
import { Button } from '../../core';
import {
  getPrimaryCategory,
  getSuggestedCategories,
  getSuggestedDescription,
} from '../../../lib/local/growthActions';
import { formatGrowthActivityDate } from '../../../lib/local/growthActionsProgress';
import type { BusinessDetails, GrowthActionLogEntry } from '../../../lib/local/types';
import {
  IconArrowDown,
  IconChat,
  IconCheck,
  IconChevronRight,
  IconClose,
  IconEdit,
  IconPicture,
} from '../icons';

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
}: {
  onSave: () => void;
  onDismiss: () => void;
  onNext: () => void;
  saveLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="local-dashboard-growth-task-actions">
      <Button type="button" size="md" variant="primary" onClick={onSave} style={{ minWidth: 148 }} disabled={disabled}>
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
