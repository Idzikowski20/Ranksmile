import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  usePeople, useInviteMember, useChangeRole, useRemoveMember, useRevokeInvitation,
  useSetMemberWorkspaces, describeWorkspaceAccess, PeopleMember,
} from '../../services/people';
import { useWorkspaces, Workspace } from '../../services/workspaces';

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

const thStyle: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: '#71717A', fontFamily: font };
const tdStyle: React.CSSProperties = { padding: '12px 16px', fontSize: 14, color: '#52525C', fontFamily: font };
// overflow visible (not hidden) so a Role dropdown in the last row isn't clipped by the card.
const tableShell: React.CSSProperties = { width: '100%', border: '1px solid #F4F4F5', borderRadius: 12, background: '#FFFFFF', overflow: 'visible' };

const Avatar = ({ initial }: { initial: string }) => (
  <div style={{ width: 32, height: 32, borderRadius: 9999, background: 'rgba(120,58,251,0.12)', color: '#783AFB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0, fontFamily: font }}>
    {initial}
  </div>
);

const Separator = () => <div role="separator" style={{ minHeight: 1, minWidth: 1, alignSelf: 'stretch', background: '#F4F4F5' }} />;

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
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  // Position the menu with `position: fixed` from the trigger's rect so it escapes the
  // settings content's `overflow-auto` (an absolute menu would be clipped near the bottom).
  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', width: compact ? 'auto' : '100%', display: compact ? 'inline-block' : 'block' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: compact ? 'auto' : '100%', minWidth: compact ? 108 : undefined, height: compact ? 32 : 40, border: '1px solid #D4D4D8', borderRadius: 8, padding: compact ? '0 8px 0 12px' : '0 10px 0 12px', fontSize: compact ? 13 : 14, color: '#18181B', background: '#FFFFFF', fontFamily: font, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', outline: 'none' }}
      >
        <span>{cap(value)}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: '#71717A', flexShrink: 0, transition: 'transform 150ms ease', transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && coords && (
        <div style={{ position: 'fixed', top: coords.top, left: coords.left, minWidth: Math.max(coords.width, compact ? 140 : 0), background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', zIndex: 1000, padding: 4, animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)' }}>
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
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
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
  // An admin may not edit/remove an owner; an owner may.
  const canActOn = (m: PeopleMember) => canManage && (callerRole === 'owner' || m.role !== 'owner');

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
    <div className="flex w-full flex-col items-start gap-base">
      <div className="gap-2xs flex flex-col">
        <span className="text-base font-semibold text-gray-140">People</span>
        <span className="text-md font-normal text-gray-100">Manage who has access to this organization</span>
      </div>

      <Separator />

      {/* Invite — managers only */}
      {canManage && (
        <div className="flex w-full flex-col gap-sm">
          <div className="gap-2xs flex flex-col">
            <span className="text-md font-medium text-gray-140">Invite people</span>
            <span className="text-md font-normal text-gray-100">Send an email invitation to add new members to your organization.</span>
          </div>

          <div style={{ border: '1px solid #F4F4F5', borderRadius: 12, padding: '20px 24px', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="flex flex-col gap-2xs">
              <label htmlFor="invite-email" style={{ fontSize: 13, fontWeight: 500, color: '#18181B', fontFamily: font }}>Email address</label>
              <input
                id="invite-email"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendInvite(); } }}
                placeholder="name@company.com"
                style={{ width: '100%', height: 40, border: '1px solid #D4D4D8', borderRadius: 8, padding: '0 12px', fontSize: 14, color: '#18181B', background: '#FFFFFF', fontFamily: font, outline: 'none', boxSizing: 'border-box' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#AA93FD'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(120,58,251,0.1)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#D4D4D8'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 200 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#18181B', fontFamily: font }}>Role</label>
                <RoleSelect value={inviteRole} options={['member', 'admin']} onChange={(v) => setInviteRole(v as 'member' | 'admin')} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#18181B', fontFamily: font }}>Workspaces</label>
                <WorkspacePicker workspaces={workspaces} selected={inviteWs} onChange={setInviteWs} disabled={inviteRole !== 'member'} />
              </div>

              <button
                type="button"
                onClick={sendInvite}
                disabled={invite.isLoading}
                className="gap-sm focus-visible:outline-purple-40 relative inline-flex cursor-pointer items-center justify-center border-none font-sans font-semibold transition-[color,background-color,box-shadow,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 [&:not(:focus-visible)]:outline-none text-md px-base py-xs rounded-md bg-gray-base text-white-base hover:bg-purple-base active:bg-purple-100"
                style={{ flexShrink: 0, height: 40, whiteSpace: 'nowrap', opacity: invite.isLoading ? 0.7 : 1 }}
              >
                <span>{invite.isLoading ? 'Sending…' : 'Send invite'}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M6 12L3.269 3.125A59.8 59.8 0 0 1 21.486 12a59.8 59.8 0 0 1-18.217 8.875z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6 12h7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {canManage && <Separator />}

      {/* Members */}
      <div className="flex w-full flex-col gap-sm">
        <span className="text-md font-medium text-gray-140">
          Members <span style={{ color: '#71717A', fontWeight: 400 }}>({members.length})</span>
        </span>

        <div style={tableShell}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '42%' }} /><col style={{ width: '16%' }} /><col style={{ width: '14%' }} /><col style={{ width: '20%' }} /><col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F4F4F5' }}>
                <th style={thStyle}>Members</th><th style={thStyle}>Role</th><th style={thStyle}>Joined</th><th style={thStyle}>Workspaces</th><th style={{ padding: '10px 16px' }} />
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td style={tdStyle} colSpan={5}>Loading…</td></tr>}
              {!isLoading && members.length === 0 && <tr><td style={tdStyle} colSpan={5}>No members yet.</td></tr>}
              {members.map((m) => {
                const email = m.email || m.user_id;
                const editable = canActOn(m) && m.id !== undefined;
                const memberWs = parseIds(m.workspace_ids);
                return (
                  <tr key={m.id} style={{ borderTop: '1px solid #F4F4F5' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar initial={(email[0] || '?').toUpperCase()} />
                        <span style={{ fontSize: 14, color: '#18181B', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
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
                    </td>
                    <td style={tdStyle}>{fmtDate(m.created_at)}</td>
                    <td style={{ padding: '12px 16px' }}>
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
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {editable && (
                        <button
                          type="button"
                          aria-label="Remove member"
                          onClick={() => { if (window.confirm(`Remove ${email}?`)) removeMember.mutate(m.id, { onSuccess: onOk('Member removed'), onError }); }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#A1A1AA', padding: 6, borderRadius: 6 }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#FF6F77'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#A1A1AA'; }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <>
          <Separator />
          <div className="flex w-full flex-col gap-sm">
            <span className="text-md font-medium text-gray-140">
              Pending Invitations <span style={{ color: '#71717A', fontWeight: 400 }}>({invitations.length})</span>
            </span>
            <div style={tableShell}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '40%' }} /><col style={{ width: '15%' }} /><col style={{ width: '17%' }} /><col style={{ width: '20%' }} /><col style={{ width: '8%' }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F4F4F5' }}>
                    <th style={thStyle}>Invitee</th><th style={thStyle}>Role</th><th style={thStyle}>Expires</th><th style={thStyle}>Workspaces</th><th style={{ padding: '10px 16px' }} />
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => (
                    <tr key={inv.id} style={{ borderTop: '1px solid #F4F4F5' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar initial={(inv.email[0] || '?').toUpperCase()} />
                          <span style={{ fontSize: 14, color: '#18181B', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</span>
                        </div>
                      </td>
                      <td style={tdStyle}>{cap(inv.role)}</td>
                      <td style={tdStyle}>{fmtDate(inv.expires_at)}</td>
                      <td style={tdStyle}>{describeWorkspaceAccess(inv.workspace_ids, wsNames)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {canManage && (
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button type="button" onClick={() => setMenuFor(menuFor === inv.id ? null : inv.id)} aria-label="More actions"
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#71717A', padding: '4px 6px', borderRadius: 6, fontSize: 18, fontWeight: 700, letterSpacing: 1, lineHeight: 1 }}>···</button>
                            {menuFor === inv.id && (
                              <div style={{ position: 'absolute', right: 0, top: '110%', background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', zIndex: 150, minWidth: 140, overflow: 'hidden', animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)' }}>
                                <button type="button"
                                  onClick={() => { setMenuFor(null); revoke.mutate(inv.id, { onSuccess: onOk('Invitation revoked'), onError }); }}
                                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 13, color: '#FF6F77', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: font }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = '#FFF0F1'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>Revoke</button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!canManage && !isLoading && (
        <span style={{ fontSize: 13, color: '#71717A', fontFamily: font }}>You don&apos;t have access to manage people. Contact an owner or admin.</span>
      )}
    </div>
  );
};

export default PeopleSettings;
