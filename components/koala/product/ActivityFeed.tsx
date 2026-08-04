import React from 'react';
import styled from '@emotion/styled';
import { Icon } from '../icons';
import { semantic } from '../tokens/semantic';
import { typeface } from '../tokens/typography';

const Root = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: ${typeface.body};
`;

const DateGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 560px;
`;

const DateLabel = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: -0.4px;
  color: ${semantic.text.secondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Timeline = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
`;

const Item = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-start;
  width: 100%;
`;

const Rail = styled.div`
  display: flex;
  gap: 8px;
  align-items: flex-start;
  align-self: stretch;
  flex-shrink: 0;
`;

const ActionIcon = styled.div`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${semantic.text.secondary};
`;

const AvatarCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  align-self: stretch;
  flex-shrink: 0;
`;

const Avatar = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  overflow: hidden;
  flex-shrink: 0;
  background: ${semantic.background.tertiary};
  color: ${semantic.text.primary};
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
`;

const AvatarImg = styled.img`
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  object-fit: cover;
  display: block;
`;

const Connector = styled.div`
  flex: 1;
  width: 1px;
  min-height: 8px;
  background: ${semantic.border.primary};
`;

const Content = styled.div<{ $last: boolean }>`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  max-width: 420px;
  padding-bottom: ${(p) => (p.$last ? 0 : 24)}px;
  align-self: stretch;
`;

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: flex-start;
  width: 100%;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: -0.4px;
`;

const Actor = styled.span`
  font-weight: 500;
  color: ${semantic.text.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Time = styled.span`
  flex: 1;
  min-width: 0;
  font-weight: 400;
  color: ${semantic.text.tertiary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Bubble = styled.div`
  width: 100%;
  box-sizing: border-box;
  padding: 8px;
  border: 1px solid ${semantic.border.primary};
  border-radius: 12px;
  background: ${semantic.background.primary};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  font-size: 14px;
  line-height: 20px;
  letter-spacing: -0.4px;
  font-weight: 400;
  color: ${semantic.text.primary};
  word-break: break-word;
`;

export type ActivityFeedEntry = {
  id: string;
  actorName: string;
  actorImage?: string | null;
  timeLabel: string;
  message: React.ReactNode;
  /** Phosphor icon name (Koala Icon_Bold). */
  icon?: string;
};

export type ActivityFeedGroupData = {
  id: string;
  dateLabel: string;
  entries: ActivityFeedEntry[];
};

/** @deprecated Prefer ActivityFeedGroupData — kept for older call sites. */
export type ActivityItem = {
  id: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  tone?: 'grey' | 'brand' | 'success' | 'danger' | 'blue';
};

type Props = {
  groups?: ActivityFeedGroupData[];
  /** Legacy flat list — rendered as a single undated group. */
  items?: ActivityItem[];
};

/** Product Activity Feed — Figma `10251:72895` (group) / item rail + message bubble. */
export function ActivityFeed({ groups, items }: Props) {
  const resolved: ActivityFeedGroupData[] = groups?.length
    ? groups
    : items?.length
      ? [{
          id: 'all',
          dateLabel: '',
          entries: items.map((item) => ({
            id: item.id,
            actorName: typeof item.title === 'string' ? item.title : 'Activity',
            timeLabel: typeof item.meta === 'string' ? item.meta : '',
            message: item.title,
            icon: 'Circle',
          })),
        }]
      : [];

  if (!resolved.length) return null;

  return (
    <Root>
      {resolved.map((group) => (
        <DateGroup key={group.id}>
          {group.dateLabel ? <DateLabel>{group.dateLabel}</DateLabel> : null}
          <Timeline>
            {group.entries.map((entry, idx) => {
              const last = idx === group.entries.length - 1;
              const initial = (entry.actorName || '?').trim().charAt(0) || '?';
              return (
                <Item key={entry.id}>
                  <Rail>
                    <ActionIcon aria-hidden>
                      <Icon name={entry.icon || 'Circle'} size={20} color="currentColor" />
                    </ActionIcon>
                    <AvatarCol>
                      {entry.actorImage ? (
                        <AvatarImg src={entry.actorImage} alt="" />
                      ) : (
                        <Avatar>{initial}</Avatar>
                      )}
                      {!last ? <Connector aria-hidden /> : null}
                    </AvatarCol>
                  </Rail>
                  <Content $last={last}>
                    <MetaRow>
                      <Actor>{entry.actorName}</Actor>
                      {entry.timeLabel ? <Time>{entry.timeLabel}</Time> : null}
                    </MetaRow>
                    <Bubble>{entry.message}</Bubble>
                  </Content>
                </Item>
              );
            })}
          </Timeline>
        </DateGroup>
      ))}
    </Root>
  );
}

export default ActivityFeed;
