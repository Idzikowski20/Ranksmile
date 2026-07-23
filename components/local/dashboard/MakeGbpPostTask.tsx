import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter } from '../../core';
import {
  GBP_POST_MAX_LENGTH,
  generateGbpPostFromTopic,
  getSuggestedGbpPost,
} from '../../../lib/local/growthActions';
import type { BusinessDetails } from '../../../lib/local/types';
import {
  IconCalendar,
  IconChevronRight,
  IconClose,
  IconLink,
  IconMagicWand,
  IconPicture,
  IconPlus,
} from '../icons';

type PopoverId = 'schedule' | 'add' | 'ai' | null;

function LogoLookingSpinner() {
  return (
    <div className="local-dashboard-growth-logo-spin" aria-hidden="true">
      <span className="local-dashboard-growth-logo-spin-ring local-dashboard-growth-logo-spin-ring--a" />
      <span className="local-dashboard-growth-logo-spin-ring local-dashboard-growth-logo-spin-ring--b" />
      <span className="local-dashboard-growth-logo-spin-ring local-dashboard-growth-logo-spin-ring--c" />
    </div>
  );
}

function useClickOutside(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open, onClose, ref]);
}

export function MakeGbpPostTask({
  details,
  onPublish,
  onDismiss,
  onNext,
  actionsDisabled = false,
}: {
  details: BusinessDetails;
  onPublish: (postText: string) => void;
  onDismiss: () => void;
  onNext: () => void;
  actionsDisabled?: boolean;
}) {
  const [phase, setPhase] = useState<'generating' | 'ready'>('generating');
  const [draft, setDraft] = useState('');
  const [topic, setTopic] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [popover, setPopover] = useState<PopoverId>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [buttonUrl, setButtonUrl] = useState('');
  const [buttonDraft, setButtonDraft] = useState('');
  const [addMode, setAddMode] = useState<'menu' | 'button'>('menu');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLDivElement>(null);
  const aiRef = useRef<HTMLDivElement>(null);

  const suggested = useMemo(() => getSuggestedGbpPost(details), [details]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDraft(suggested);
      setPhase('ready');
    }, 2200);
    return () => clearTimeout(timer);
  }, [suggested]);

  useEffect(() => () => {
    if (imageUrl?.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  useClickOutside(popover === 'schedule', () => setPopover(null), scheduleRef);
  useClickOutside(popover === 'add', () => setPopover(null), addRef);
  useClickOutside(popover === 'ai', () => setPopover(null), aiRef);

  const canSubmit = phase === 'ready' && draft.trim().length > 0 && !actionsDisabled;
  const charCount = draft.length;

  const closePopovers = () => setPopover(null);

  const submitPost = () => {
    if (!canSubmit) return;
    closePopovers();
    setPreviewOpen(false);
    onPublish(draft.trim());
  };

  const onGenerate = () => {
    setDraft(generateGbpPostFromTopic(details, topic));
    setPopover(null);
  };

  return (
    <>
      <div className="local-dashboard-growth-task-body local-dashboard-growth-gbp-post">
        {phase === 'generating' ? (
          <div className="local-dashboard-growth-gbp-post-loading" data-testid="spin-loading-state">
            <LogoLookingSpinner />
            <span>Generating your post...</span>
          </div>
        ) : (
          <div className="local-dashboard-growth-gbp-post-editor">
            <textarea
              className="local-dashboard-growth-gbp-post-textarea"
              value={draft}
              rows={4}
              maxLength={GBP_POST_MAX_LENGTH}
              placeholder="Share your news and updates..."
              disabled={actionsDisabled}
              onChange={(e) => setDraft(e.target.value.slice(0, GBP_POST_MAX_LENGTH))}
            />
            {imageUrl && (
              <div className="local-dashboard-growth-gbp-post-media">
                <img src={imageUrl} alt="Post attachment" />
                <button
                  type="button"
                  aria-label="Remove image"
                  disabled={actionsDisabled}
                  onClick={() => {
                    if (imageUrl.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
                    setImageUrl(null);
                  }}
                >
                  <IconClose size={14} color="#52525C" />
                </button>
              </div>
            )}
            {buttonUrl && (
              <div className="local-dashboard-growth-gbp-post-cta">
                <IconLink size={14} color="#6A6772" />
                <span>{buttonUrl}</span>
                <button type="button" aria-label="Remove button" disabled={actionsDisabled} onClick={() => setButtonUrl('')}>
                  <IconClose size={14} color="#52525C" />
                </button>
              </div>
            )}
            <div className="local-dashboard-growth-gbp-post-toolbar">
              <div className="local-dashboard-growth-gbp-post-tools">
                <div className="local-dashboard-growth-popover-anchor" ref={aiRef}>
                  <button
                    type="button"
                    className={`local-dashboard-growth-pill local-dashboard-growth-pill--ai${popover === 'ai' ? ' is-active' : ''}`}
                    disabled={actionsDisabled}
                    onClick={() => setPopover((prev) => (prev === 'ai' ? null : 'ai'))}
                  >
                    <IconMagicWand size={16} color="#3B82F6" />
                    AI Writer
                  </button>
                  {popover === 'ai' && (
                    <div className="local-dashboard-growth-popover local-dashboard-growth-popover--ai" role="dialog" aria-label="AI Writer">
                      <h5>AI Writer</h5>
                      <label>
                        Topic (optional)
                        <input
                          type="text"
                          value={topic}
                          placeholder="What do we write about?"
                          onChange={(e) => setTopic(e.target.value)}
                        />
                      </label>
                      <button type="button" className="local-dashboard-growth-schedule-confirm" onClick={onGenerate}>
                        <IconMagicWand size={16} color="#FFFFFF" />
                        Generate post
                      </button>
                      <p>If nothing comes to mind, just click the button.</p>
                    </div>
                  )}
                </div>

                <div className="local-dashboard-growth-popover-anchor" ref={addRef}>
                  <button
                    type="button"
                    className={`local-dashboard-growth-pill${popover === 'add' ? ' is-active' : ''}`}
                    disabled={actionsDisabled}
                    onClick={() => {
                      setAddMode('menu');
                      setPopover((prev) => (prev === 'add' ? null : 'add'));
                    }}
                  >
                    <IconPlus size={16} color="currentColor" />
                    Add
                  </button>
                  {popover === 'add' && (
                    <div className="local-dashboard-growth-popover local-dashboard-growth-popover--menu" role="menu">
                      {addMode === 'menu' ? (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              imageInputRef.current?.click();
                              setPopover(null);
                            }}
                          >
                            <IconPicture size={16} color="#52525C" />
                            Add image
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setButtonDraft(buttonUrl || details.website || '');
                              setAddMode('button');
                            }}
                          >
                            <IconLink size={16} color="#52525C" />
                            Add button
                          </button>
                        </>
                      ) : (
                        <div className="local-dashboard-growth-add-button-form">
                          <label>
                            Button URL
                            <input
                              type="url"
                              value={buttonDraft}
                              placeholder="https://"
                              onChange={(e) => setButtonDraft(e.target.value)}
                            />
                          </label>
                          <div className="local-dashboard-growth-schedule-actions">
                            <button
                              type="button"
                              className="local-dashboard-growth-schedule-confirm"
                              onClick={() => {
                                setButtonUrl(buttonDraft.trim());
                                setPopover(null);
                                setAddMode('menu');
                              }}
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              className="local-dashboard-growth-schedule-cancel"
                              onClick={() => setAddMode('menu')}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    if (imageUrl?.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
                    setImageUrl(URL.createObjectURL(file));
                  }}
                />
              </div>
              <div className="local-dashboard-growth-gbp-post-meta">
                <button
                  type="button"
                  className="local-dashboard-growth-preview-btn"
                  disabled={actionsDisabled || !draft.trim()}
                  onClick={() => setPreviewOpen(true)}
                >
                  Preview
                </button>
                <span>
                  {charCount}
                  /
                  {GBP_POST_MAX_LENGTH}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="local-dashboard-growth-task-actions local-dashboard-growth-gbp-post-actions">
        <div className="local-dashboard-growth-gbp-post-primary">
          <div className="local-dashboard-growth-popover-anchor" ref={scheduleRef}>
            <button
              type="button"
              className="local-dashboard-growth-schedule-btn"
              disabled={!canSubmit}
              aria-expanded={popover === 'schedule'}
              onClick={() => setPopover((prev) => (prev === 'schedule' ? null : 'schedule'))}
            >
              <IconCalendar size={16} color="#FFFFFF" />
              Schedule
            </button>
            {popover === 'schedule' && (
              <div className="local-dashboard-growth-popover local-dashboard-growth-popover--schedule" role="dialog" aria-label="Schedule post">
                <div className="local-dashboard-growth-schedule-fields">
                  <label>
                    Date
                    <span className="local-dashboard-growth-schedule-input">
                      <IconCalendar size={14} color="#A1A1AA" />
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                      />
                    </span>
                  </label>
                  <label>
                    Time
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                  </label>
                </div>
                <div className="local-dashboard-growth-schedule-actions">
                  <button
                    type="button"
                    className="local-dashboard-growth-schedule-confirm"
                    disabled={!scheduleDate || !scheduleTime}
                    onClick={submitPost}
                  >
                    Schedule
                  </button>
                  <button type="button" className="local-dashboard-growth-schedule-cancel" onClick={() => setPopover(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          <Button type="button" size="md" variant="secondary" disabled={!canSubmit} onClick={submitPost}>
            Publish now
          </Button>
        </div>
        <div className="local-dashboard-growth-task-secondary">
          <Button type="button" size="md" variant="transparent" onClick={onDismiss} disabled={actionsDisabled}>
            Dismiss
          </Button>
          <span className="local-dashboard-divider" />
          <button type="button" className="local-dashboard-icon-btn" aria-label="Next task" onClick={onNext} disabled={actionsDisabled}>
            <IconChevronRight size={16} color="#52525C" />
          </button>
        </div>
      </div>

      {previewOpen && (
        <Modal onClose={() => setPreviewOpen(false)} width={520} closeOnOverlayClick>
          <div className="local-dashboard-growth-preview-header">
            <button type="button" aria-label="Close" onClick={() => setPreviewOpen(false)}>
              <IconClose size={14} color="#6A6772" />
            </button>
          </div>
          <ModalBody>
            <p className="local-dashboard-growth-preview-text">{draft}</p>
            {imageUrl && (
              <img src={imageUrl} alt="" className="local-dashboard-growth-preview-image" />
            )}
            {buttonUrl && (
              <div className="local-dashboard-growth-preview-cta">{buttonUrl}</div>
            )}
          </ModalBody>
          <ModalFooter>
            <button type="button" className="local-dashboard-growth-schedule-btn" disabled={!canSubmit} onClick={submitPost}>
              <IconCalendar size={16} color="#FFFFFF" />
              Schedule
            </button>
            <Button type="button" size="md" variant="secondary" disabled={!canSubmit} onClick={submitPost}>
              Publish now
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
