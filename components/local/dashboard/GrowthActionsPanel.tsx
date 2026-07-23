import { useRouter } from 'next/router';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  applyBusinessLogo,
  applyBusinessPhotos,
  applyCoverPhoto,
  applySuggestedCategories,
  applySuggestedDescription,
  GROWTH_TASKS,
  hasBusinessLogo,
  hasCategorySuggestions,
  hasCoverPhoto,
  hasEnoughBusinessPhotos,
  type GrowthTaskId,
} from '../../../lib/local/growthActions';
import {
  areAllGrowthTasksDoneToday,
  buildGrowthActivityLog,
  countGrowthDoneToday,
  GROWTH_DAILY_TOTAL,
  growthDayKey,
  isGrowthDayCurrent,
  resetGrowthActionsForToday,
} from '../../../lib/local/growthActionsProgress';
import type { BusinessDetails, GrowthActionLogEntry } from '../../../lib/local/types';
import {
  IconCheck,
  IconSparkle,
  GrowthKeepItUpIllustration,
} from '../icons';
import {
  AddCategoriesTask,
  AddCoverPhotoTask,
  AddLogoTask,
  AddPhotosTask,
  GrowthActivityList,
  GrowthTaskFeedback,
  ImproveDescriptionTask,
  SetupAgentTask,
  type TaskOutcome,
} from './growthTaskCards';
import { MakeGbpPostTask } from './MakeGbpPostTask';

type GrowthProgressPatch = {
  growthActionsDay: string;
  growthActionsCompletedIds: GrowthTaskId[];
  growthActionsLog: GrowthActionLogEntry[];
};

type GrowthActionsPanelProps = {
  slug: string;
  details: BusinessDetails;
  onDetailsChange: (details: BusinessDetails) => void;
  locationCreatedAt: string | null;
  growthActionsDay: string | null;
  growthActionsCompletedIds: GrowthTaskId[];
  growthActionsLog: GrowthActionLogEntry[];
  onGrowthProgressChange: (patch: GrowthProgressPatch) => void;
  mrtPending?: boolean;
};

type TaskTransitionPhase = 'feedback-in' | 'feedback-out' | 'entering';

type TaskTransition = {
  outcome: TaskOutcome;
  phase: TaskTransitionPhase;
};

const GROWTH_FEEDBACK_FADE_MS = 300;
const GROWTH_FEEDBACK_HOLD_MS = 900;
const GROWTH_TASK_ENTER_MS = 320;

export default function GrowthActionsPanel({
  slug,
  details,
  onDetailsChange,
  locationCreatedAt,
  growthActionsDay,
  growthActionsCompletedIds,
  growthActionsLog,
  onGrowthProgressChange,
  mrtPending = false,
}: GrowthActionsPanelProps) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [taskTransition, setTaskTransition] = React.useState<TaskTransition | null>(null);
  const transitionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTransitionTimers = useCallback(() => {
    transitionTimersRef.current.forEach((timer) => clearTimeout(timer));
    transitionTimersRef.current = [];
  }, []);

  useEffect(() => () => clearTransitionTimers(), [clearTransitionTimers]);

  useEffect(() => {
    if (!isGrowthDayCurrent(growthActionsDay)) {
      onGrowthProgressChange(resetGrowthActionsForToday());
    }
  }, [growthActionsDay, onGrowthProgressChange]);

  const completedSet = useMemo(
    () => new Set<GrowthTaskId>(growthActionsCompletedIds),
    [growthActionsCompletedIds],
  );

  const visibleTasks = useMemo(
    () => GROWTH_TASKS.filter((task) => {
      if (completedSet.has(task.id)) return false;
      if (task.id === 'add-categories' && !hasCategorySuggestions(details)) return false;
      if (task.id === 'add-logo' && hasBusinessLogo(details)) return false;
      if (task.id === 'add-cover-photo' && hasCoverPhoto(details)) return false;
      if (task.id === 'add-photos' && hasEnoughBusinessPhotos(details)) return false;
      return true;
    }),
    [completedSet, details],
  );

  const activeTask = visibleTasks[activeIndex] ?? visibleTasks[0] ?? null;
  const allDone = areAllGrowthTasksDoneToday(growthActionsCompletedIds, details);
  const growthDone = countGrowthDoneToday(growthActionsCompletedIds, details);
  const growthPct = (growthDone / GROWTH_DAILY_TOTAL) * 100;

  const tasksBehind = activeTask
    ? Math.max(0, visibleTasks.length - activeIndex - 1)
    : 0;
  const backdropLayerCount = Math.min(tasksBehind, 2);

  const activityLog = useMemo(
    () => buildGrowthActivityLog(growthActionsCompletedIds, growthActionsLog, locationCreatedAt),
    [growthActionsCompletedIds, growthActionsLog, locationCreatedAt],
  );

  const completeTask = useCallback((taskId: GrowthTaskId) => {
    if (completedSet.has(taskId)) return;
    const task = GROWTH_TASKS.find((item) => item.id === taskId);
    const today = growthDayKey();
    onGrowthProgressChange({
      growthActionsDay: today,
      growthActionsCompletedIds: [...growthActionsCompletedIds, taskId],
      growthActionsLog: [
        ...growthActionsLog,
        {
          key: taskId,
          title: task?.title ?? taskId,
          completedAt: new Date().toISOString(),
        },
      ],
    });
    setActiveIndex(0);
  }, [completedSet, growthActionsCompletedIds, growthActionsLog, onGrowthProgressChange]);

  const runTaskOutcome = useCallback((
    taskId: GrowthTaskId,
    outcome: TaskOutcome,
    applyChanges?: () => void,
    afterComplete?: () => void,
  ) => {
    if (taskTransition || completedSet.has(taskId)) return;

    clearTransitionTimers();
    applyChanges?.();

    setTaskTransition({ outcome, phase: 'feedback-in' });

    const schedule = (delay: number, fn: () => void) => {
      const timer = setTimeout(fn, delay);
      transitionTimersRef.current.push(timer);
    };

    schedule(GROWTH_FEEDBACK_FADE_MS + GROWTH_FEEDBACK_HOLD_MS, () => {
      setTaskTransition((prev) => (prev ? { ...prev, phase: 'feedback-out' } : null));
    });

    schedule(
      GROWTH_FEEDBACK_FADE_MS + GROWTH_FEEDBACK_HOLD_MS + GROWTH_FEEDBACK_FADE_MS,
      () => {
        completeTask(taskId);
        setTaskTransition({ outcome, phase: 'entering' });
        afterComplete?.();
      },
    );

    schedule(
      GROWTH_FEEDBACK_FADE_MS + GROWTH_FEEDBACK_HOLD_MS + GROWTH_FEEDBACK_FADE_MS + GROWTH_TASK_ENTER_MS,
      () => setTaskTransition(null),
    );
  }, [clearTransitionTimers, completeTask, completedSet, taskTransition]);

  const transitionLocked = taskTransition !== null;
  const feedbackPhase =
    taskTransition?.phase === 'feedback-in' || taskTransition?.phase === 'feedback-out'
      ? taskTransition.phase
      : null;
  const showFeedback = feedbackPhase !== null;
  const taskContentPhaseClass = taskTransition
    ? taskTransition.phase === 'entering'
      ? 'local-dashboard-growth-task-content--enter'
      : 'local-dashboard-growth-task-content--hidden'
    : '';

  const goNext = () => {
    if (transitionLocked || visibleTasks.length <= 1) return;
    setActiveIndex((i) => (i + 1) % visibleTasks.length);
  };

  const handleSaveCategories = (extraCategories: string[]) => {
    runTaskOutcome('add-categories', 'accepted', () => {
      onDetailsChange(applySuggestedCategories(details, extraCategories));
    });
  };

  const handleSaveDescription = (description: string) => {
    runTaskOutcome('improve-description', 'accepted', () => {
      onDetailsChange(applySuggestedDescription(details, description));
    });
  };

  const handleSaveLogo = (logoUrl: string) => {
    runTaskOutcome('add-logo', 'accepted', () => {
      onDetailsChange(applyBusinessLogo(details, logoUrl));
    });
  };

  const handleSaveCoverPhoto = (coverUrl: string) => {
    runTaskOutcome('add-cover-photo', 'accepted', () => {
      onDetailsChange(applyCoverPhoto(details, coverUrl));
    });
  };

  const handleSavePhotos = (photoUrls: string[]) => {
    runTaskOutcome('add-photos', 'accepted', () => {
      onDetailsChange(applyBusinessPhotos(details, photoUrls));
    });
  };

  const handlePublishGbpPost = (_postText: string) => {
    runTaskOutcome('schedule-gbp-post', 'accepted');
  };

  const handleDismissTask = (taskId: GrowthTaskId) => {
    runTaskOutcome(taskId, 'rejected');
  };

  const handleAcceptAgent = () => {
    runTaskOutcome('setup-agent', 'accepted', undefined, () => {
      void router.push(`/sites/${slug}/local/gbp-ai-agent`);
    });
  };

  return (
    <section className="local-dashboard-card local-dashboard-growth">
      <div className="local-dashboard-growth-header">
        <h3>Growth Actions</h3>
        <div className={`local-dashboard-growth-progress${allDone ? ' local-dashboard-growth-progress--complete' : ''}`}>
          {allDone ? (
            <IconCheck size={16} color="#1AB25E" />
          ) : (
            <span
              className="local-dashboard-donut"
              style={{ background: `conic-gradient(#653DE9 0 ${growthPct}%, #E4E4E7 ${growthPct}% 100%)` }}
              aria-hidden="true"
            />
          )}
          <span>
            {growthDone}
            /
            {GROWTH_DAILY_TOTAL}
            {' '}
            done today
          </span>
        </div>
      </div>

      {allDone ? (
        <div className="local-dashboard-growth-complete">
          <div className="local-dashboard-growth-complete-card">
            <GrowthKeepItUpIllustration />
            <h4>Keep it up!</h4>
            <p>Come back tomorrow for more growth actions.</p>
          </div>
          <GrowthActivityList entries={activityLog} locationCreatedAt={locationCreatedAt} />
        </div>
      ) : activeTask && (
        <div
          className="local-dashboard-growth-stack"
          style={{ '--growth-backdrop-layers': backdropLayerCount } as React.CSSProperties}
        >
          {backdropLayerCount > 0 && (
            <div className="local-dashboard-growth-backdrop" aria-hidden="true">
              {Array.from({ length: backdropLayerCount }, (_, layerIndex) => (
                <div
                  key={layerIndex}
                  className="local-dashboard-growth-backdrop-layer"
                  style={{ '--growth-layer-depth': backdropLayerCount - layerIndex } as React.CSSProperties}
                />
              ))}
            </div>
          )}

          <div className="local-dashboard-growth-task-card">
            {showFeedback && feedbackPhase && taskTransition && (
              <GrowthTaskFeedback outcome={taskTransition.outcome} phase={feedbackPhase} />
            )}

            <div className={`local-dashboard-growth-task ${taskContentPhaseClass}`}>
              <div
                className="local-dashboard-growth-illustration"
                style={{ width: 200, height: activeTask.imageHeight ?? 220 }}
              >
                <img src={activeTask.image} alt="" loading="lazy" decoding="async" />
              </div>

              <div className="local-dashboard-growth-copy">
                <div className="local-dashboard-growth-copy-inner">
                  <div>
                    <div className="local-dashboard-growth-task-title">
                      <h4>{activeTask.title}</h4>
                      <IconSparkle size={16} color="#783AFB" />
                    </div>
                    {activeTask.id === 'add-photos' ? (
                      <p>
                        {activeTask.subtitle}
                        {' '}
                        <button
                          type="button"
                          className="local-dashboard-growth-inline-link"
                          title="Businesses with photos typically get around 60% more views on Google."
                        >
                          60% more views
                        </button>
                      </p>
                    ) : (
                      <p>{activeTask.subtitle}</p>
                    )}
                    <div className="local-dashboard-growth-divider" />
                  </div>

                  {activeTask.id === 'setup-agent' && (
                    <SetupAgentTask
                      onAccept={handleAcceptAgent}
                      onDismiss={() => handleDismissTask('setup-agent')}
                      onNext={goNext}
                      actionsDisabled={transitionLocked}
                    />
                  )}
                  {activeTask.id === 'add-logo' && (
                    <AddLogoTask
                      onSave={handleSaveLogo}
                      onDismiss={() => handleDismissTask('add-logo')}
                      onNext={goNext}
                      actionsDisabled={transitionLocked}
                    />
                  )}
                  {activeTask.id === 'add-cover-photo' && (
                    <AddCoverPhotoTask
                      onSave={handleSaveCoverPhoto}
                      onDismiss={() => handleDismissTask('add-cover-photo')}
                      onNext={goNext}
                      actionsDisabled={transitionLocked}
                    />
                  )}
                  {activeTask.id === 'add-photos' && (
                    <AddPhotosTask
                      details={details}
                      onSave={handleSavePhotos}
                      onDismiss={() => handleDismissTask('add-photos')}
                      onNext={goNext}
                      actionsDisabled={transitionLocked}
                    />
                  )}
                  {activeTask.id === 'schedule-gbp-post' && (
                    <MakeGbpPostTask
                      details={details}
                      onPublish={handlePublishGbpPost}
                      onDismiss={() => handleDismissTask('schedule-gbp-post')}
                      onNext={goNext}
                      actionsDisabled={transitionLocked}
                    />
                  )}
                  {activeTask.id === 'add-categories' && (
                    <AddCategoriesTask
                      details={details}
                      onSave={handleSaveCategories}
                      onDismiss={() => handleDismissTask('add-categories')}
                      onNext={goNext}
                      actionsDisabled={transitionLocked}
                    />
                  )}
                  {activeTask.id === 'improve-description' && (
                    <ImproveDescriptionTask
                      details={details}
                      onSave={handleSaveDescription}
                      onDismiss={() => handleDismissTask('improve-description')}
                      onNext={goNext}
                      actionsDisabled={transitionLocked}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!allDone && growthActionsCompletedIds.length > 0 && (
        <GrowthActivityList entries={activityLog} locationCreatedAt={locationCreatedAt} />
      )}

      {mrtPending && (
        <div className="local-dashboard-activity local-dashboard-activity--pending">
          <span className="local-dashboard-mini-spin" aria-hidden="true" />
          <span>Map Rank Tracker campaign is being created in the background…</span>
        </div>
      )}

      <div className="local-dashboard-feedback-row">
        <span>Have any ideas for Growth Actions?</span>
        <button type="button" className="local-dashboard-link-btn">Send feedback</button>
      </div>
    </section>
  );
}
