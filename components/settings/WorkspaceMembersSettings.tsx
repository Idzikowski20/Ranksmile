import React, { useState } from 'react';
import { useWorkspaces } from '../../services/workspaces';
import { useWorkspaceMembers } from '../../services/workspaceMembers';
import ManageMembersModal from './ManageMembersModal';
import { Button } from '../core';
import {
  SentrySettingsSection,
  SentrySettingsRow,
  SentryPanel,
  SentryTable,
  SentryTableHead,
  SentryTableBody,
  SentryTableRow,
  SentryTableCell,
  SentryTableHeaderCell,
} from '../sentry-pages';

const font = 'var(--font-family-primary)';
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const Avatar = ({ initial }: { initial: string }) => (
  <div style={{ width: 32, height: 32, borderRadius: 9999, background: 'rgba(120,58,251,0.12)', color: '#783AFB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0, fontFamily: font }}>
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

  return (
    <>
      <SentrySettingsSection title="Access">
        <SentrySettingsRow
          label="Workspace members"
          description={`Manage who has access to ${workspaceName} workspace.`}
        >
          <Button type="button" variant="primary" disabled={wsId === null} onClick={() => setModalOpen(true)}>
            Manage members
          </Button>
        </SentrySettingsRow>
      </SentrySettingsSection>

      <SentryPanel noPadding>
        <SentryTable>
          <SentryTableHead>
            <SentryTableRow>
              <SentryTableHeaderCell>Member</SentryTableHeaderCell>
              <SentryTableHeaderCell>Role</SentryTableHeaderCell>
              <SentryTableHeaderCell>{' '}</SentryTableHeaderCell>
            </SentryTableRow>
          </SentryTableHead>
          <SentryTableBody>
            {isLoading && (
              <SentryTableRow>
                <SentryTableCell colSpan={3}>Loading…</SentryTableCell>
              </SentryTableRow>
            )}
            {!isLoading && accessMembers.length === 0 && (
              <SentryTableRow>
                <SentryTableCell colSpan={3}>No members have access yet.</SentryTableCell>
              </SentryTableRow>
            )}
            {accessMembers.map((m) => {
              const email = m.email || '—';
              return (
                <SentryTableRow key={m.id}>
                  <SentryTableCell>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar initial={(email[0] || '?').toUpperCase()} />
                      <span style={{ fontSize: 14, color: '#18181B', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
                    </div>
                  </SentryTableCell>
                  <SentryTableCell>{cap(m.role)}</SentryTableCell>
                  <SentryTableCell>{' '}</SentryTableCell>
                </SentryTableRow>
              );
            })}
          </SentryTableBody>
        </SentryTable>
      </SentryPanel>

      {wsId !== null && (
        <ManageMembersModal wsId={wsId} open={modalOpen} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
};

export default WorkspaceMembersSettings;
