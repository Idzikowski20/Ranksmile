import React, { useState } from 'react';
import { Button, CompactSelect } from '../koala/core';
import { Icon } from '../koala/icons/Icon';
import { EmailTagInput } from '../koala/core/emailTagInput/emailTagInput';

/** Owner is granted, never invited — an org has one and it is whoever created it. */
export type InviteRole = 'admin' | 'member';

export type PendingInvite = { email: string; role: InviteRole };

const ROLE_OPTIONS: Array<{ value: InviteRole; label: string }> = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
];

function roleLabel(role: InviteRole): string {
  return ROLE_OPTIONS.find((o) => o.value === role)?.label ?? 'Member';
}

/**
 * Onboarding invite step — Figma `1:261`, adapted rather than copied.
 *
 * Dropped from that design: "Copy link" and "People with access". Neither has any
 * backing here — an organisation has no public mode and no invite links — and a
 * control that does nothing is worse in onboarding than an absent one.
 *
 * Kept and wired: the role, which the design puts next to the address and again on
 * each invited row. It used to be hardcoded to 'member' at send time.
 */
export function InviteTeamStep({
  invites,
  onChange,
  disabled,
}: {
  invites: PendingInvite[];
  onChange: (next: PendingInvite[]) => void;
  disabled?: boolean;
}) {
  const [draftRole, setDraftRole] = useState<InviteRole>('member');

  // EmailTagInput is the entry field, not the display: it is handed an empty value and
  // drained on every change, so an address appears exactly once — below, on the row that
  // carries its role. Left holding its own chips it showed each address twice.
  const setEmails = (next: string[]) => {
    if (!next.length) return;
    const known = new Set(invites.map((i) => i.email));
    const added = next
      .filter((email) => !known.has(email))
      .map((email) => ({ email, role: draftRole }));
    if (added.length) onChange([...invites, ...added]);
  };

  const setRoleFor = (email: string, role: InviteRole) => {
    onChange(invites.map((i) => (i.email === email ? { ...i, role } : i)));
  };

  return (
    <div className="invite-step">
      <div className="invite-step__banner">
        <p className="invite-step__banner-title">
          <strong>Invite others</strong>
          {' to collaborate in this workspace'}
        </p>
        <p className="invite-step__banner-sub">
          Add a teammate by email to plan, write and review alongside you.
        </p>
      </div>

      <div className="invite-step__row">
        <div className="invite-step__emails">
          <EmailTagInput
            label="Teammate email address"
            value={[]}
            onChange={setEmails}
            disabled={disabled}
          />
        </div>
        <CompactSelect
          value={draftRole}
          onChange={(o) => setDraftRole(o.value)}
          options={ROLE_OPTIONS}
          disabled={disabled}
        />
      </div>

      {invites.length > 0 && (
        <>
          <div className="invite-step__divider" aria-hidden="true" />
          <p className="invite-step__count">
            {`${invites.length} to invite`}
          </p>
          <ul className="invite-step__list">
            {invites.map((i) => (
              <li key={i.email} className="invite-step__person">
                <span className="invite-step__avatar" aria-hidden="true">
                  {i.email.charAt(0).toUpperCase()}
                </span>
                <span className="invite-step__email">{i.email}</span>
                {/* ponytail: ceiling = CompactSelect renders no accessible name of its
                    own and does not forward aria-label, so a screen reader hears the
                    role but not whose it is; the row's email is adjacent. Upgrade =
                    give CompactSelect an ariaLabel prop on its trigger. */}
                <CompactSelect
                  value={i.role}
                  onChange={(o) => setRoleFor(i.email, o.value)}
                  options={ROLE_OPTIONS}
                  disabled={disabled}
                />
                <Button
                  type="button"
                  variant="transparent"
                  size="xs"
                  aria-label={`Remove ${i.email}`}
                  disabled={disabled}
                  onClick={() => onChange(invites.filter((x) => x.email !== i.email))}
                >
                  <Icon name="X" size={16} weight="bold" />
                </Button>
              </li>
            ))}
          </ul>
          <p className="invite-step__note">
            {`Everyone joins as ${roleLabel(invites[0].role)} unless you change it above. `}
            You can adjust roles later in Settings.
          </p>
        </>
      )}
    </div>
  );
}

export default InviteTeamStep;
