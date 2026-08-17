import React, { useState } from 'react';
import { Button, Select } from '../koala/core';
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

/** Select hands back a plain string; narrow it rather than casting. */
function toRole(value: string): InviteRole {
  return value === 'admin' ? 'admin' : 'member';
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
        {/* Select, not CompactSelect: the latter is @deprecated with an explicit
            "do not add new call sites for simple menus", and a two-option role
            picker is exactly that. The .invite-step__role wrapper is what strips its
            chrome so the row reads as one bordered field — same as in settings. */}
        <div className="invite-step__role">
          <Select
            value={draftRole}
            onChange={(v) => setDraftRole(toRole(v))}
            options={ROLE_OPTIONS}
            disabled={disabled}
            size="sm"
          />
        </div>
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
                {/* ponytail: ceiling = Select renders no accessible name of its own and
                    takes no aria-label, so a screen reader hears the role but not whose
                    it is; the row's email is adjacent. Upgrade = give Select an
                    ariaLabel prop on its trigger. */}
                <Select
                  value={i.role}
                  onChange={(v) => setRoleFor(i.email, toRole(v))}
                  options={ROLE_OPTIONS}
                  disabled={disabled}
                  size="sm"
                  width={124}
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
          {/* Describes draftRole — the role the control above assigns to the NEXT address
              typed — not the listed invites, which each carry their own role and can be
              changed per row. Reading the first invite's role here claimed one role for
              everyone and went stale as soon as a row was edited. */}
          <p className="invite-step__note">
            {`New invites join as ${roleLabel(draftRole)} unless you change it above. `}
            You can adjust roles per person here, or later in Settings.
          </p>
        </>
      )}
    </div>
  );
}

export default InviteTeamStep;
