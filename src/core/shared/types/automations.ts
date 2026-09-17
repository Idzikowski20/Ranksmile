export type AutomationPublishMode = 'draft' | 'live';

/**
 * Event lifecycle: scheduled (deferred, nothing created yet) → generating (draft made,
 * content being written) → created (draft ready), or for a live event → publishing
 * (WordPress post under way) → published.
 * `failed` is terminal for any step that errored.
 */
export type AutomationEventStatus = 'scheduled' | 'generating' | 'created' | 'publishing' | 'published' | 'failed';

const AUTOMATION_STATUSES: AutomationEventStatus[] = ['scheduled', 'generating', 'created', 'publishing', 'published', 'failed'];

export type AutomationEvent = {
  id: number;
  domainId: number;
  workspaceId: number;
  scheduledDate: string;
  title: string;
  targetKeyword: string;
  publishMode: AutomationPublishMode;
  articleId: number | null;
  /** The generated article's title (chosen by the LLM) once it exists; the event title is the keyword. */
  articleTitle?: string | null;
  status: AutomationEventStatus;
  createdAt: string | null;
};

export type AutomationEventRow = {
  id: number;
  domain_id: number;
  workspace_id: number;
  scheduled_date: string;
  title: string;
  target_keyword: string;
  publish_mode: string;
  article_id: number | null;
  article_title?: string | null;
  status: string;
  created_at: string | null;
};

export function mapAutomationEvent(row: AutomationEventRow): AutomationEvent {
  const publishMode: AutomationPublishMode = row.publish_mode === 'live' ? 'live' : 'draft';
  const status: AutomationEventStatus = (AUTOMATION_STATUSES as string[]).includes(row.status)
    ? (row.status as AutomationEventStatus)
    : 'scheduled';
  return {
    id: row.id,
    domainId: row.domain_id,
    workspaceId: row.workspace_id,
    scheduledDate: String(row.scheduled_date).slice(0, 10),
    title: row.title,
    targetKeyword: row.target_keyword || '',
    publishMode,
    articleId: row.article_id,
    articleTitle: row.article_title?.trim() || null,
    status,
    createdAt: row.created_at,
  };
}
