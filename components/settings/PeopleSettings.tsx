import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  usePeople, useInviteMember, useChangeRole, useRemoveMember, useRevokeInvitation,
  useSetMemberWorkspaces, describeWorkspaceAccess, PeopleMember,
} from '../../services/people';
import { useWorkspaces, Workspace } from '../../services/workspaces';
import { Button, Input, MenuListItem } from '../core';
import {
  SentrySettingsSection,
  SentrySettingsRow,
  SentryPanel,
  SentryPanelBody,
  SentryTable,
  SentryTableHead,
  SentryTableBody,
  SentryTableRow,
  SentryTableCell,
  SentryTableHeaderCell,
} from '../sentry-pages';

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
  <div style={{ width: 32, height: 32, borderRadius: 9999, background: 'rgba(120,58,251,0.12)', color: '#783AFB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0, fontFamily: font }}>
    {initial}
  </div>
);

const CheckMark = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0, color: '#18181B' }}>
    <path fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" />
  </svg>
);

/** Surfer-style role dropdown (custom popover, not a native select). `compact` = inline pill for table rows. */
const RoleSelect = ({ value, options, onChange, compact }: {
  value: string; options: readonly string[]; onChange: (v: string) => void; compact?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', width: compact ? 'auto' : '100%', display: compact ? 'inline-block' : 'block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: compact ? 'auto' : '100%', minWidth: compact ? 108 : undefined, height: compact ? 32 : 40, border: '1px solid #D4D4D8', borderRadius: 8, padding: compact ? '0 8px 0 12px' : '0 10px 0 12px', fontSize: compact ? 13 : 14, color: '#18181B', background: '#FFFFFF', fontFamily: font, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', outline: 'none' }}
      >
        <span>{cap(value)}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: '#71717A', flexShrink: 0, transition: 'transform 150ms ease', transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', left: 0, minWidth: compact ? 140 : '100%', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', zIndex: 150, padding: 4, animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)' }}>
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => { onChange(o); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: compact ? 13 : 14, fontWeight: o === value ? 600 : 500, color: '#2F2F34', fontFamily: font }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span>{cap(o)}</span>
              {o === value && <CheckMark />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** Compact checkbox dropdown for picking workspaces (the per-Member access list). */
const WorkspacePicker = ({ workspaces, selected, onChange, disabled }: {
  workspaces: Workspace[]; selected: number[]; onChange: (ids: number[]) => void; disabled?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  const label = disabled ? 'All workspaces' : selected.length ? `${selected.length} workspace${selected.length > 1 ? 's' : ''}` : 'Select workspaces';
  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        style={{ height: 40, width: '100%', border: '1px solid #D4D4D8', borderRadius: 8, padding: '0 12px', fontSize: 14, color: disabled ? '#71717A' : '#18181B', background: '#FFFFFF', fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', cursor: disabled ? 'default' : 'pointer' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: '#71717A', flexShrink: 0 }}>
            <path d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {label}
        </span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: '#71717A', flexShrink: 0, transition: 'transform 150ms ease', transform: open && !disabled ? 'rotate(180deg)' : 'none' }}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && !disabled && (
        <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', zIndex: 150, maxHeight: 220, overflowY: 'auto', padding: 4, animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)' }}>
          {workspaces.length === 0 && <div style={{ padding: '10px 12px', fontSize: 13, color: '#71717A', fontFamily: font }}>No workspaces</div>}
          {workspaces.map((w) => {
            const checked = selected.includes(w.id);
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => toggle(w.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#18181B', fontFamily: font }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: checked ? '1px solid #783AFB' : '1px solid #D4D4D8', background: checked ? '#783AFB' : '#FFFFFF', transition: 'background 120ms ease, border-color 120ms ease' }}>
                  {checked && (
                    <svg width="10" height="10" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M5 10.5l3 3 7-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {w.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

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
  // An owner's role can never be changed and an owner can never be removed (from this UI).
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
      {canManage && (
        <SentrySettingsSection title="Invite people">
          <SentrySettingsRow label="Email invitation" description="Send an email invitation to add new members to your organization.">
            <SentryPanel>
              <SentryPanelBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Input
                    id="invite-email"
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendInvite(); } }}
                    placeholder="name@company.com"
                    style={{ width: '100%', maxWidth: 360 }}
                  />
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 200 }}>
                      <label style={{ fontSize: 13, fontWeight: 500, color: '#18181B', fontFamily: font }}>Role</label>
                      <RoleSelect value={inviteRole} options={['member', 'admin']} onChange={(v) => setInviteRole(v as 'member' | 'admin')} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
                      <label style={{ fontSize: 13, fontWeight: 500, color: '#18181B', fontFamily: font }}>Workspaces</label>
                      <WorkspacePicker workspaces={workspaces} selected={inviteWs} onChange={setInviteWs} disabled={inviteRole !== 'member'} />
                    </div>
                    <Button type="button" variant="primary" onClick={sendInvite} disabled={invite.isLoading} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {invite.isLoading ? 'Sending…' : 'Send invite'}
                    </Button>
                  </div>
                </div>
              </SentryPanelBody>
            </SentryPanel>
          </SentrySettingsRow>
        </SentrySettingsSection>
      )}

      <SentrySettingsSection title={`Members (${members.length})`}>
        <SentrySettingsRow label="Organization members" description="People with access to this organization.">
          <div style={{ width: '100%', overflow: 'visible' }}>
            <SentryPanel noPadding>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar initial={(email[0] || '?').toUpperCase()} />
                        <span style={{ fontSize: 14, color: '#18181B', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
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
                        <span style={{ fontSize: 14, color: '#52525C', fontFamily: font }}>{cap(m.role)}</span>
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
                        <span style={{ fontSize: 14, color: '#52525C', fontFamily: font }}>
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
                          style={{ color: '#A1A1AA' }}
                        />
                      )}
                    </SentryTableCell>
                  </SentryTableRow>
                );
              })}
              </SentryTableBody>
            </SentryTable>
            </SentryPanel>
          </div>
        </SentrySettingsRow>
      </SentrySettingsSection>

      {invitations.length > 0 && (
        <SentrySettingsSection title={`Pending invitations (${invitations.length})`}>
          <SentrySettingsRow label="Outstanding invites" description="Invitations that haven't been accepted yet.">
            <div style={{ width: '100%' }}>
              <SentryPanel noPadding>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar initial={(inv.email[0] || '?').toUpperCase()} />
                          <span style={{ fontSize: 14, color: '#18181B', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</span>
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
                              style={{ color: '#71717A', fontSize: 18, fontWeight: 700, letterSpacing: 1, lineHeight: 1, padding: '4px 6px' }}
                            >
                              ···
                            </Button>
                            {menuFor === inv.id && (
                              <div style={{ position: 'absolute', right: 0, top: '110%', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', zIndex: 150, minWidth: 140, overflow: 'hidden', animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)' }}>
                                <MenuListItem
                                  label="Revoke"
                                  priority="danger"
                                  onClick={() => { setMenuFor(null); revoke.mutate(inv.id, { onSuccess: onOk('Invitation revoked'), onError }); }}
                                  style={{ width: '100%', fontFamily: font, fontSize: 13 }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </SentryTableCell>
                    </SentryTableRow>
                  ))}
                </SentryTableBody>
              </SentryTable>
              </SentryPanel>
            </div>
          </SentrySettingsRow>
        </SentrySettingsSection>
      )}

      {!canManage && !isLoading && (
        <span style={{ fontSize: 13, color: '#71717A', fontFamily: font }}>You don&apos;t have access to manage people. Contact an owner or admin.</span>
      )}
    </div>
  );
};

export default PeopleSettings;
