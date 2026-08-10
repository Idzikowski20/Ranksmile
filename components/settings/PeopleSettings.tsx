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
          {/* Label carried by the banner inside, so the row does not repeat it. */}
          <KoalaSettingsRow layout="stack" label="">
            {/* Same shape as the onboarding invite step (Figma 1:261): a banner, then
                address + role + action on one line. The two surfaces do the same job and
                used to look unrelated — this one stacked four full-width controls. */}
            <div className="invite-step">
              <div className="invite-step__banner">
                <p className="invite-step__banner-title">
                  <strong>Invite others</strong>
                  {' to collaborate in this organization'}
                </p>
                <p className="invite-step__banner-sub">
                  They receive an email invitation and pick their own password.
                </p>
              </div>

              <div className="invite-step__row">
                <div className="invite-step__emails">
                  <Input
                    id="invite-email"
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendInvite(); } }}
                    placeholder="name@company.com"
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="invite-step__role">
                  <RoleSelect value={inviteRole} options={['member', 'admin']} onChange={(v) => setInviteRole(v as 'member' | 'admin')} />
                </div>
                <Button type="button" variant="primary" onClick={sendInvite} disabled={invite.isLoading}>
                  {invite.isLoading ? 'Sending…' : 'Send invite'}
                </Button>
              </div>

              {/* Kept below the row, not dropped: unlike the Figma's link controls this
                  one is real — a member's access is scoped to the workspaces picked here. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--koala-text-primary)', fontFamily: font }}>Workspaces</span>
                <WorkspacePicker workspaces={workspaces} selected={inviteWs} onChange={setInviteWs} disabled={inviteRole !== 'member'} />
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
          {/* A list, not a table — Figma 1:261 puts people on rows, not in columns.
              Joined date and workspace access move to the row's second line rather than
              being dropped: in settings they are the answer to "who can see what", which
              a sharing popover never had to carry. */}
          <ul className="invite-step__list">
            {isLoading && <li className="invite-step__note">Loading…</li>}
            {!isLoading && members.length === 0 && <li className="invite-step__note">No members yet.</li>}
            {members.map((m) => {
              const email = m.email || m.user_id;
              const editable = canActOn(m) && m.id !== undefined;
              const memberWs = parseIds(m.workspace_ids);
              const access = m.role === 'member' ? describeWorkspaceAccess(m.workspace_ids, wsNames) : 'All';
              return (
                <li key={m.id} className="invite-step__person">
                  <span className="invite-step__avatar" aria-hidden="true">{(email[0] || '?').toUpperCase()}</span>
                  <span className="invite-step__who">
                    <span className="invite-step__email">{email}</span>
                    <span className="invite-step__meta">{`Joined ${fmtDate(m.created_at)} · ${access}`}</span>
                  </span>
                  {editable ? (
                    <div className="invite-step__role">
                      <RoleSelect
                        value={m.role}
                        options={ROLES}
                        compact
                        onChange={(v) => changeRole.mutate({ id: m.id, role: v }, { onSuccess: onOk('Role updated'), onError })}
                      />
                    </div>
                  ) : (
                    <span className="invite-step__meta">{cap(m.role)}</span>
                  )}
                  {editable && m.role === 'member' && (
                    <WorkspacePicker
                      workspaces={workspaces}
                      selected={memberWs}
                      onChange={(ids) => setWorkspaces.mutate({ id: m.id, workspaceIds: ids.length ? ids : null }, { onError })}
                    />
                  )}
                  {editable && (
                    <Button
                      type="button"
                      variant="transparent"
                      size="sm"
                      aria-label={`Remove ${email}`}
                      onClick={() => { if (window.confirm(`Remove ${email}?`)) removeMember.mutate(m.id, { onSuccess: onOk('Member removed'), onError }); }}
                      icon={(
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      style={{ color: 'var(--koala-text-tertiary)' }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </KoalaSettingsRow>
      </KoalaSettingsSection>

      {invitations.length > 0 && (
        <KoalaSettingsSection title={`Pending invitations (${invitations.length})`}>
          <KoalaSettingsRow
            layout="stack"
            label="Outstanding invites"
            description="Invitations that haven't been accepted yet."
          >
            <ul className="invite-step__list">
              {invitations.map((inv) => (
                <li key={inv.id} className="invite-step__person">
                  <span className="invite-step__avatar" aria-hidden="true">{(inv.email[0] || '?').toUpperCase()}</span>
                  <span className="invite-step__who">
                    <span className="invite-step__email">{inv.email}</span>
                    <span className="invite-step__meta">
                      {`${cap(inv.role)} · expires ${fmtDate(inv.expires_at)} · ${describeWorkspaceAccess(inv.workspace_ids, wsNames)}`}
                    </span>
                  </span>
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
                </li>
              ))}
            </ul>
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
