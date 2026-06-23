import React, { useState } from 'react';
import toast from 'react-hot-toast';

type Role = 'Member' | 'Admin';

const STATIC_MEMBER = {
  initial: 'P',
  email: 'patryk.idzikowski@interia.pl',
  role: 'Owner',
  joined: '23 Jun 2026',
  workspaces: 'All',
};

const STATIC_PENDING = {
  initial: 'B',
  email: 'boski.idzikowski@gmail.com',
  role: 'Admin',
  expires: '30 Jun 2026',
  workspaces: 'All',
};

const Avatar = ({ initial, color = '#783AFB' }: { initial: string; color?: string }) => (
  <div
    style={{
      width: 32,
      height: 32,
      borderRadius: 9999,
      background: color === '#783AFB' ? 'rgba(120,58,251,0.12)' : 'rgba(120,58,251,0.08)',
      color: '#783AFB',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
      fontWeight: 600,
      flexShrink: 0,
      fontFamily: 'var(--font-family-primary)',
    }}
  >
    {initial}
  </div>
);

const Separator = () => (
  <div
    role="separator"
    style={{ minHeight: 1, minWidth: 1, alignSelf: 'stretch', background: '#F4F4F5' }}
  />
);

const PeopleSettings = () => {
  const [emailInput, setEmailInput] = useState('');
  const [role, setRole] = useState<Role>('Member');
  const [dotsOpen, setDotsOpen] = useState(false);

  const handleResend = () => {
    setDotsOpen(false);
    toast.success('Invitation resent');
  };

  return (
    <div className="flex w-full flex-col items-start gap-base">
      {/* Header */}
      <div className="gap-2xs flex flex-col">
        <span className="text-base font-semibold text-gray-140">People</span>
        <span className="text-md font-normal text-gray-100">
          Manage who has access to this organization
        </span>
      </div>

      <Separator />

      {/* Invite section */}
      <div className="flex w-full flex-col gap-sm">
        <div className="gap-2xs flex flex-col">
          <span className="text-md font-medium text-gray-140">Invite people</span>
          <span className="text-md font-normal text-gray-100">
            Send an email invitation to add new members to your organization.
          </span>
        </div>

        {/* Invite card */}
        <div
          style={{
            border: '1px solid #F4F4F5',
            borderRadius: 12,
            padding: '20px 24px',
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Email input */}
          <div className="flex flex-col gap-2xs">
            <label
              htmlFor="invite-emails"
              style={{ fontSize: 13, fontWeight: 500, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}
            >
              Email addresses
            </label>
            <input
              id="invite-emails"
              type="text"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="name@company.com, name2@company.com..."
              style={{
                width: '100%',
                height: 40,
                border: '1px solid #D4D4D8',
                borderRadius: 8,
                padding: '0 12px',
                fontSize: 14,
                color: '#18181B',
                background: '#FFFFFF',
                fontFamily: 'var(--font-family-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#AA93FD';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(120,58,251,0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#D4D4D8';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <span style={{ fontSize: 12, color: '#71717A', fontFamily: 'var(--font-family-primary)' }}>
              Press Enter, Tab or comma to add. Paste a list to add many at once.
            </span>
          </div>

          {/* Role + Workspaces + Send invite row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            {/* Role select */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 200 }}>
              <label
                htmlFor="invite-role"
                style={{ fontSize: 13, fontWeight: 500, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}
              >
                Role
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  style={{
                    appearance: 'none',
                    width: '100%',
                    height: 40,
                    border: '1px solid #D4D4D8',
                    borderRadius: 8,
                    padding: '0 32px 0 12px',
                    fontSize: 14,
                    color: '#18181B',
                    background: '#FFFFFF',
                    fontFamily: 'var(--font-family-primary)',
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  <option value="Member">Member</option>
                  <option value="Admin">Admin</option>
                </select>
                {/* Chevron icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#71717A' }}
                >
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Workspaces static control */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <label
                style={{ fontSize: 13, fontWeight: 500, color: '#18181B', fontFamily: 'var(--font-family-primary)' }}
              >
                Workspaces
              </label>
              <div
                style={{
                  height: 40,
                  border: '1px solid #D4D4D8',
                  borderRadius: 8,
                  padding: '0 12px',
                  fontSize: 14,
                  color: '#18181B',
                  background: '#FFFFFF',
                  fontFamily: 'var(--font-family-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  cursor: 'default',
                  userSelect: 'none',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Folder icon */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: '#71717A', flexShrink: 0 }}>
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                  All workspaces
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: '#71717A', flexShrink: 0 }}>
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Send invite button */}
            <button
              type="button"
              className="gap-sm focus-visible:outline-purple-40 relative inline-flex cursor-pointer items-center justify-center border-none font-sans font-semibold transition-[color,background-color,box-shadow,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 [&:not(:focus-visible)]:outline-none text-md px-base py-xs rounded-md bg-gray-base text-white-base hover:bg-purple-base active:bg-purple-100"
              style={{ flexShrink: 0, height: 40, whiteSpace: 'nowrap' }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ flexShrink: 0 }}
              >
                <path
                  d="M6 12L3.269 3.125A59.8 59.8 0 0 1 21.486 12a59.8 59.8 0 0 1-18.217 8.875z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6 12h7.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Send invite</span>
            </button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Members table */}
      <div className="flex w-full flex-col gap-sm">
        <span className="text-md font-medium text-gray-140">
          Members{' '}
          <span style={{ color: '#71717A', fontWeight: 400 }}>(1/5)</span>
        </span>

        <div
          style={{
            width: '100%',
            border: '1px solid #F4F4F5',
            borderRadius: 12,
            background: '#FFFFFF',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '45%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F4F4F5' }}>
                <th
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#71717A',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  Members
                </th>
                <th
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#71717A',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Role
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: '#A1A1AA', flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M12 11v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="12" cy="8" r="0.75" fill="currentColor" />
                    </svg>
                  </span>
                </th>
                <th
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#71717A',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  Joined
                </th>
                <th
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#71717A',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  Workspaces
                </th>
                <th style={{ padding: '10px 16px' }} />
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar initial={STATIC_MEMBER.initial} />
                    <span
                      style={{
                        fontSize: 14,
                        color: '#18181B',
                        fontFamily: 'var(--font-family-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {STATIC_MEMBER.email}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 14, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
                  {STATIC_MEMBER.role}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 14, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
                  {STATIC_MEMBER.joined}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 14, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
                  {STATIC_MEMBER.workspaces}
                </td>
                <td style={{ padding: '12px 16px' }} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <Separator />

      {/* Pending Invitations section */}
      <div className="flex w-full flex-col gap-sm">
        <span className="text-md font-medium text-gray-140">
          Pending Invitations{' '}
          <span style={{ color: '#71717A', fontWeight: 400 }}>(1)</span>
        </span>

        <div
          style={{
            width: '100%',
            border: '1px solid #F4F4F5',
            borderRadius: 12,
            background: '#FFFFFF',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '40%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid #F4F4F5' }}>
                <th
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#71717A',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  Invitee
                </th>
                <th
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#71717A',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  Role
                </th>
                <th
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#71717A',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  Expires
                </th>
                <th
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#71717A',
                    fontFamily: 'var(--font-family-primary)',
                  }}
                >
                  Workspaces
                </th>
                <th style={{ padding: '10px 16px' }} />
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar initial={STATIC_PENDING.initial} />
                    <span
                      style={{
                        fontSize: 14,
                        color: '#18181B',
                        fontFamily: 'var(--font-family-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {STATIC_PENDING.email}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 14, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
                  {STATIC_PENDING.role}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 14, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
                  {STATIC_PENDING.expires}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 14, color: '#52525C', fontFamily: 'var(--font-family-primary)' }}>
                  {STATIC_PENDING.workspaces}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                      type="button"
                      onClick={() => setDotsOpen((v) => !v)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#71717A',
                        padding: '4px 6px',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        fontWeight: 700,
                        letterSpacing: 1,
                        lineHeight: 1,
                      }}
                      aria-label="More actions"
                    >
                      ···
                    </button>
                    {dotsOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: '110%',
                          background: '#FFFFFF',
                          border: '1px solid #E4E4E7',
                          borderRadius: 8,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                          zIndex: 150,
                          minWidth: 160,
                          overflow: 'hidden',
                          animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={handleResend}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '9px 14px',
                            fontSize: 13,
                            color: '#18181B',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-family-primary)',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          Resend invitation
                        </button>
                        <button
                          type="button"
                          onClick={() => setDotsOpen(false)}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '9px 14px',
                            fontSize: 13,
                            color: '#FF6F77',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-family-primary)',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#FFF0F1'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PeopleSettings;
