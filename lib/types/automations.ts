export type AutomationPublishMode = 'draft' | 'live';

export type AutomationEventStatus = 'scheduled' | 'created' | 'failed';

export type AutomationEvent = {
  id: number;
  domainId: number;
  workspaceId: number;
  scheduledDate: string;
  title: string;
  targetKeyword: string;
  publishMode: AutomationPublishMode;
  articleId: number | null;
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
  status: string;
  created_at: string | null;
};

export function mapAutomationEvent(row: AutomationEventRow): AutomationEvent {
  const publishMode: AutomationPublishMode = row.publish_mode === 'live' ? 'live' : 'draft';
  const status: AutomationEventStatus =
    row.status === 'created' || row.status === 'failed' ? row.status : 'scheduled';
  return {
    id: row.id,
    domainId: row.domain_id,
    workspaceId: row.workspace_id,
    scheduledDate: String(row.scheduled_date).slice(0, 10),
    title: row.title,
    targetKeyword: row.target_keyword || '',
    publishMode,
    articleId: row.article_id,
    status,
    createdAt: row.created_at,
  };
}
