import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  usePeople, useInviteMember, useChangeRole, useRemoveMember, useRevokeInvitation,
  useSetMemberWorkspaces, describeWorkspaceAccess, PeopleMember,
} from '../../services/people';
import { useWorkspaces, Workspace } from '../../services/workspaces';
import { Button, CompactSelect, Input, MenuList, MenuListItem, Select } from '../koala/core';
import { Icon } from '../koala/icons';
import {
  KoalaSettingsSection,
  KoalaSettingsRow,
  KoalaPanel,
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
const ROLES = ['member', 'admin', 'owner'] as const;
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const fmtDate = (s: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const parseIds = (json: string | null): number[] => {
  if (!json) return [];
  try { const v = JSON.parse(json); return Array.isArray(v) ? v.map(Number) : []; } catch { return []; }
};

const Avatar = ({ initial }: { initial: string }) => (
  <div
    style={{
      width: 32,
      height: 32,
      borderRadius: 9999,
      background: 'rgba(248,68,22,0.12)',
      color: '#F84416',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
      fontWeight: 600,
      flexShrink: 0,
      fontFamily: font,
    }}
  >
    {initial}
  </div>
);

const roleOptions = (options: readonly string[]) => options.map((o) => ({ value: o, label: cap(o) }));

const RoleSelect = ({ value, options, onChange, compact }: {
  value: string; options: readonly string[]; onChange: (v: string) => void; compact?: boolean;
}) => (
  <div style={{ width: compact ? 'auto' : '100%', maxWidth: compact ? undefined : 360, display: compact ? 'inline-block' : 'block' }}>
    <Select
      size={compact ? 'sm' : 'md'}
      width={compact ? undefined : '100%'}
      value={value}
      options={roleOptions(options)}
      onChange={onChange}
    />
  </div>
);

const WorkspacePicker = ({ workspaces, selected, onChange, disabled }: {
  workspaces: Workspace[]; selected: number[]; onChange: (ids: number[]) => void; disabled?: boolean;
}) => (
  <div style={{ width: '100%', maxWidth: 360 }}>
    <CompactSelect
      multiple
      disabled={disabled}
      size="sm"
      value={selected}
      prefix={<Icon name="Folder" size={16} color="var(--koala-text-secondary)" />}
      triggerLabel={disabled ? 'All workspaces' : selected.length === 0 ? 'Select workspaces' : undefined}
      emptyMessage="No workspaces"
      options={workspaces.map((w) => ({ value: w.id, label: w.name }))}
      onChange={(opts) => onChange(opts.map((o) => o.value))}
    />
  </div>
);

const PeopleSettings = () => {
  const { data, isLoading } = usePeople();
  const { data: wsData } = useWorkspaces();
  const invite = useInviteMember();
  const changeRole = useChangeRole();
  const removeMember = useRemoveMember();
  const revoke = useRevokeInvitation();
  const setWorkspaces = useSetMemberWorkspaces();

  const [emailInput, setEmailInput] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviteWs, setInviteWs] = useState<number[]>([]);
  const [menuFor, setMenuFor] = useState<number | null>(null);

  const workspaces = wsData?.workspaces || [];
  const wsNames = useMemo(() => new Map(workspaces.map((w) => [w.id, w.name])), [workspaces]);
  const callerRole = data?.role ?? null;
  const canManage = callerRole === 'owner' || callerRole === 'admin';
  const canActOn = (m: PeopleMember) => canManage && m.role !== 'owner';

  const onError = (e: unknown): void => { toast.error(e instanceof Error ? e.message : 'Something went wrong'); };
  const onOk = (msg: string) => (): void => { toast.success(msg); };

  const sendInvite = () => {
    const email = emailInput.trim();
    if (!email) { toast.error('Enter an email address'); return; }
    invite.mutate(
      { email, role: inviteRole, workspaceIds: inviteRole === 'member' ? inviteWs : null },
      { onSuccess: () => { toast.success('Invitation sent'); setEmailInput(''); setInviteWs([]); }, onError },
    );
  };

  const members = data?.members || [];
  const invitations = data?.invitations || [];

  return (
    <div className="koala-people-settings" style={{ display: 'flex', flexDirection: 'column', gap: 32, width: '100%', minWidth: 0 }}>
      {canManage && (
        <KoalaSettingsSection title="Invite people">
          <KoalaSettingsRow
            layout="stack"
            label="Email invitation"
            description="Send an email invitation to add new members to your organization."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 400 }}>
              <Input
                id="invite-email"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendInvite(); } }}
                placeholder="name@company.com"
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--koala-text-primary)', fontFamily: font }}>Role</span>
                <RoleSelect value={inviteRole} options={['member', 'admin']} onChange={(v) => setInviteRole(v as 'member' | 'admin')} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--koala-text-primary)', fontFamily: font }}>Workspaces</span>
                <WorkspacePicker workspaces={workspaces} selected={inviteWs} onChange={setInviteWs} disabled={inviteRole !== 'member'} />
              </div>
              <div className="koala-account-actions">
                <Button type="button" variant="primary" onClick={sendInvite} disabled={invite.isLoading}>
                  {invite.isLoading ? 'Sending…' : 'Send invite'}
                </Button>
              </div>
            </div>
          </KoalaSettingsRow>
        </KoalaSettingsSection>
      )}

      <KoalaSettingsSection title={`Members (${members.length})`}>
        <KoalaSettingsRow
          layout="stack"
          label="Organization members"
          description="People with access to this organization."
        >
          <div className="koala-people-table">
            <KoalaPanel noPadding>
              <SentryTable>
                <SentryTableHead>
                  <SentryTableRow>
                    <SentryTableHeaderCell>Members</SentryTableHeaderCell>
                    <SentryTableHeaderCell>Role</SentryTableHeaderCell>
                    <SentryTableHeaderCell>Joined</SentryTableHeaderCell>
                    <SentryTableHeaderCell>Workspaces</SentryTableHeaderCell>
                    <SentryTableHeaderCell>{' '}</SentryTableHeaderCell>
                  </SentryTableRow>
                </SentryTableHead>
                <SentryTableBody>
                  {isLoading && (
                    <SentryTableRow><SentryTableCell colSpan={5}>Loading…</SentryTableCell></SentryTableRow>
                  )}
                  {!isLoading && members.length === 0 && (
                    <SentryTableRow><SentryTableCell colSpan={5}>No members yet.</SentryTableCell></SentryTableRow>
                  )}
                  {members.map((m) => {
                    const email = m.email || m.user_id;
                    const editable = canActOn(m) && m.id !== undefined;
                    const memberWs = parseIds(m.workspace_ids);
                    return (
                      <SentryTableRow key={m.id}>
                        <SentryTableCell>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <Avatar initial={(email[0] || '?').toUpperCase()} />
                            <span style={{ fontSize: 14, color: 'var(--koala-text-primary)', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
                          </div>
                        </SentryTableCell>
                        <SentryTableCell>
                          {editable ? (
                            <RoleSelect
                              value={m.role}
                              options={ROLES}
                              compact
                              onChange={(v) => changeRole.mutate({ id: m.id, role: v }, { onSuccess: onOk('Role updated'), onError })}
                            />
                          ) : (
                            <span style={{ fontSize: 14, color: 'var(--koala-text-secondary)', fontFamily: font }}>{cap(m.role)}</span>
                          )}
                        </SentryTableCell>
                        <SentryTableCell>{fmtDate(m.created_at)}</SentryTableCell>
                        <SentryTableCell>
                          {editable && m.role === 'member' ? (
                            <WorkspacePicker
                              workspaces={workspaces}
                              selected={memberWs}
                              onChange={(ids) => setWorkspaces.mutate({ id: m.id, workspaceIds: ids.length ? ids : null }, { onError })}
                            />
                          ) : (
                            <span style={{ fontSize: 14, color: 'var(--koala-text-secondary)', fontFamily: font }}>
                              {m.role === 'member' ? describeWorkspaceAccess(m.workspace_ids, wsNames) : 'All'}
                            </span>
                          )}
                        </SentryTableCell>
                        <SentryTableCell align="center">
                          {editable && (
                            <Button
                              type="button"
                              variant="transparent"
                              size="sm"
                              aria-label="Remove member"
                              onClick={() => { if (window.confirm(`Remove ${email}?`)) removeMember.mutate(m.id, { onSuccess: onOk('Member removed'), onError }); }}
                              icon={(
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                  <path d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                              style={{ color: 'var(--koala-text-tertiary)' }}
                            />
                          )}
                        </SentryTableCell>
                      </SentryTableRow>
                    );
                  })}
                </SentryTableBody>
              </SentryTable>
            </KoalaPanel>
          </div>
        </KoalaSettingsRow>
      </KoalaSettingsSection>

      {invitations.length > 0 && (
        <KoalaSettingsSection title={`Pending invitations (${invitations.length})`}>
          <KoalaSettingsRow
            layout="stack"
            label="Outstanding invites"
            description="Invitations that haven't been accepted yet."
          >
            <div className="koala-people-table">
              <KoalaPanel noPadding>
                <SentryTable>
                  <SentryTableHead>
                    <SentryTableRow>
                      <SentryTableHeaderCell>Invitee</SentryTableHeaderCell>
                      <SentryTableHeaderCell>Role</SentryTableHeaderCell>
                      <SentryTableHeaderCell>Expires</SentryTableHeaderCell>
                      <SentryTableHeaderCell>Workspaces</SentryTableHeaderCell>
                      <SentryTableHeaderCell>{' '}</SentryTableHeaderCell>
                    </SentryTableRow>
                  </SentryTableHead>
                  <SentryTableBody>
                    {invitations.map((inv) => (
                      <SentryTableRow key={inv.id}>
                        <SentryTableCell>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <Avatar initial={(inv.email[0] || '?').toUpperCase()} />
                            <span style={{ fontSize: 14, color: 'var(--koala-text-primary)', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</span>
                          </div>
                        </SentryTableCell>
                        <SentryTableCell>{cap(inv.role)}</SentryTableCell>
                        <SentryTableCell>{fmtDate(inv.expires_at)}</SentryTableCell>
                        <SentryTableCell>{describeWorkspaceAccess(inv.workspace_ids, wsNames)}</SentryTableCell>
                        <SentryTableCell align="center">
                          {canManage && (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <Button
                                type="button"
                                variant="transparent"
                                size="sm"
                                onClick={() => setMenuFor(menuFor === inv.id ? null : inv.id)}
                                aria-label="More actions"
                                style={{ color: 'var(--koala-text-secondary)', fontSize: 18, fontWeight: 700, letterSpacing: 1, lineHeight: 1, padding: '4px 6px' }}
                              >
                                ···
                              </Button>
                              {menuFor === inv.id && (
                                <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 150 }}>
                                  <MenuList>
                                    <MenuListItem
                                      label="Revoke"
                                      priority="danger"
                                      onClick={() => { setMenuFor(null); revoke.mutate(inv.id, { onSuccess: onOk('Invitation revoked'), onError }); }}
                                      style={{ width: '100%', fontFamily: font, fontSize: 13 }}
                                    />
                                  </MenuList>
                                </div>
                              )}
                            </div>
                          )}
                        </SentryTableCell>
                      </SentryTableRow>
                    ))}
                  </SentryTableBody>
                </SentryTable>
              </KoalaPanel>
            </div>
          </KoalaSettingsRow>
        </KoalaSettingsSection>
      )}

      {!canManage && !isLoading && (
        <span style={{ fontSize: 13, color: 'var(--koala-text-secondary)', fontFamily: font }}>
          You don&apos;t have access to manage people. Contact an owner or admin.
        </span>
      )}
    </div>
  );
};

export default PeopleSettings;
