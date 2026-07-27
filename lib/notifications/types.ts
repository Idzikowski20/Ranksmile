export type NotificationType = 'optimization_recommendation';

export interface InboxItem {
  eventId: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  domain: string;
  slug: string;
  count: number;
  at: string;
  revision: number;
  isRead: boolean;
}

export interface InboxListResponse {
  unreadCount: number;
  items: InboxItem[];
}

export interface MarkInboxReadInput {
  eventIds?: string[];
  all?: boolean;
}

export interface DomainSnapshotRow {
  domain_id: number;
  workspace_id: number;
  domain: string;
  slug: string;
  org_id: number;
  current_count: number;
  latest_at: string | null;
}
