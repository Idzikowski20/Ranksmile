import { useMemo, useState } from 'react';
import Modal, { ModalBody } from '../core/modal/modal';
import Button from '../core/button/button';
import { Chip, Select } from '../core';
import Input from '../core/input/input';
import { Form, FormField, FormSection, FormActions, FieldHint } from '../forms';
import { useCreateTeam } from '../../../services/team';

export type CreateTeamDialogProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Create Team — Figma `7900:165760`.
 * Sections: Workspace / Members / Permissions (structure only; API via teamAdapter).
 */
export function CreateTeamDialog({ open, onClose }: CreateTeamDialogProps) {
  const createTeam = useCreateTeam();
  const [name, setName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [role, setRole] = useState<'member' | 'manager'>('member');

  const canSubmit = name.trim().length > 0;

  const addEmail = () => {
    const e = emailInput.trim().toLowerCase();
    if (!e || !e.includes('@')) return;
    setEmails((prev) => (prev.includes(e) ? prev : [...prev, e]));
    setEmailInput('');
  };

  const chips = useMemo(() => emails, [emails]);

  const submit = () => {
    createTeam.mutate(
      { name: name.trim(), emails, role },
      {
        onSettled: () => {
          /* stub may error with NOT_IMPLEMENTED — toast already shown */
          onClose();
          setName('');
          setEmails([]);
          setEmailInput('');
        },
      },
    );
  };

  if (!open) return null;

  return (
    <Modal title="Create team" onClose={onClose} width={480}>
      <ModalBody>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) submit();
          }}
        >
          <FormSection title="Workspace" description="Name your workspace.">
            <FormField label="Name" required>
              <Input
                size="md"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Inc"
                autoFocus
              />
            </FormField>
          </FormSection>

          <FormSection title="Members" description="Invite teammates by email.">
            <FormField label="Invite emails">
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  size="md"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addEmail();
                    }
                  }}
                  placeholder="name@company.com"
                />
                <Button type="button" size="md" variant="secondary" onClick={addEmail}>
                  Add
                </Button>
              </div>
            </FormField>
            {chips.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {chips.map((e) => (
                  <Chip
                    key={e}
                    size="sm"
                    onDismiss={() => setEmails((prev) => prev.filter((x) => x !== e))}
                  >
                    {e}
                  </Chip>
                ))}
              </div>
            ) : null}
          </FormSection>

          <FormSection title="Permissions">
            <FieldHint>Default invite role. Advanced roles may require a plan upgrade.</FieldHint>
            <FormField label="Role">
              <Select
                size="md"
                width="100%"
                value={role}
                options={[
                  { value: 'member', label: 'Member' },
                  { value: 'manager', label: 'Manager' },
                ]}
                onChange={(v) => setRole(v as 'member' | 'manager')}
              />
            </FormField>
          </FormSection>

          <FormActions>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={!canSubmit || createTeam.isLoading} busy={createTeam.isLoading}>
              Create
            </Button>
          </FormActions>
        </Form>
      </ModalBody>
    </Modal>
  );
}

export default CreateTeamDialog;
