import React, { useState } from 'react';
import { useWorkspaces } from '../../services/workspaces';
import { useWorkspaceMembers } from '../../services/workspaceMembers';
import ManageMembersModal from './ManageMembersModal';
import { Button } from '../koala/core';
import {
  KoalaSettingsSection,
  KoalaSettingsRow,
  KoalaPanel,
  KoalaEmptyState,
} from '../koala/layout';
import {
  SentryTable,
  SentryTableHead,
  SentryTableBody,
  SentryTableRow,
  SentryTableCell,
  SentryTableHeaderCell,
} from '../koala/layout';

const font = 'var(--font-family-primary)';
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const Avatar = ({ initial }: { initial: string }) => (
  <div style={{ width: 32, height: 32, borderRadius: 9999, background: 'color-mix(in srgb, var(--koala-brand) 12%, transparent)', color: 'var(--koala-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0, fontFamily: font }}>
    {initial}
  </div>
);

const WorkspaceMembersSettings = () => {
  const { data: wsData } = useWorkspaces();
  const workspaces = wsData?.workspaces || [];
  const current = workspaces.find((w) => w.id === wsData?.activeId) || workspaces[0];
  const wsId = current?.id ?? null;
  const workspaceName = current?.name || 'this';

  const { data, isLoading } = useWorkspaceMembers(wsId);
  const [modalOpen, setModalOpen] = useState(false);

  const accessMembers = (data?.members || []).filter((m) => m.hasAccess);
  const hasMembers = !isLoading && accessMembers.length > 0;
  const isEmpty = !isLoading && accessMembers.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
      <KoalaSettingsSection title="Access">
        <KoalaSettingsRow
          layout="stack"
          label="Workspace members"
          description={`Manage who has access to ${workspaceName} workspace.`}
        >
          {hasMembers && (
            <Button type="button" variant="primary" size="sm" disabled={wsId === null} onClick={() => setModalOpen(true)}>
              Manage members
            </Button>
          )}
        </KoalaSettingsRow>
      </KoalaSettingsSection>

      {isLoading && (
        <KoalaPanel noPadding>
          <SentryTable>
            <SentryTableHead>
              <SentryTableRow>
                <SentryTableHeaderCell>Member</SentryTableHeaderCell>
                <SentryTableHeaderCell>Role</SentryTableHeaderCell>
                <SentryTableHeaderCell>{' '}</SentryTableHeaderCell>
              </SentryTableRow>
            </SentryTableHead>
            <SentryTableBody>
              <SentryTableRow>
                <SentryTableCell colSpan={3}>Loading…</SentryTableCell>
              </SentryTableRow>
            </SentryTableBody>
          </SentryTable>
        </KoalaPanel>
      )}

      {isEmpty && (
        <KoalaEmptyState
          title="No members yet"
          description="No one has access to this workspace yet."
          actions={(
            <Button type="button" variant="primary" disabled={wsId === null} onClick={() => setModalOpen(true)}>
              Manage members
            </Button>
          )}
        />
      )}

      {hasMembers && (
        <KoalaPanel noPadding>
          <SentryTable>
            <SentryTableHead>
              <SentryTableRow>
                <SentryTableHeaderCell>Member</SentryTableHeaderCell>
                <SentryTableHeaderCell>Role</SentryTableHeaderCell>
                <SentryTableHeaderCell>{' '}</SentryTableHeaderCell>
              </SentryTableRow>
            </SentryTableHead>
            <SentryTableBody>
              {accessMembers.map((m) => {
                const email = m.email || '—';
                return (
                  <SentryTableRow key={m.id}>
                    <SentryTableCell>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar initial={(email[0] || '?').toUpperCase()} />
                        <span style={{ fontSize: 14, color: 'var(--koala-text-primary)', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
                      </div>
                    </SentryTableCell>
                    <SentryTableCell>{cap(m.role)}</SentryTableCell>
                    <SentryTableCell>{' '}</SentryTableCell>
                  </SentryTableRow>
                );
              })}
            </SentryTableBody>
          </SentryTable>
        </KoalaPanel>
      )}

      {wsId !== null && (
        <ManageMembersModal wsId={wsId} open={modalOpen} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
};

export default WorkspaceMembersSettings;
