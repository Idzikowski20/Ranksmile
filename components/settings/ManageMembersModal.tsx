import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Modal, { ModalBody, ModalFooter } from '../koala/core/modal/modal';
import { Button, Checkbox, Input } from '../koala/core';
import { useWorkspaceMembers, useSetWorkspaceMembers, WorkspaceMemberRow } from '../../services/workspaceMembers';

const font = 'var(--font-family-primary)';
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const isManager = (role: string) => role === 'owner' || role === 'admin';

const thStyle: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: 'var(--koala-text-tertiary)', fontFamily: font };

const Avatar = ({ initial }: { initial: string }) => (
   <div style={{ width: 32, height: 32, borderRadius: 9999, background: 'rgba(248,68,22,0.12)', color: 'var(--koala-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0, fontFamily: font }}>
      {initial}
   </div>
);

const ManageMembersModal = ({ wsId, open, onClose }: { wsId: number; open: boolean; onClose: () => void }) => {
   const { data } = useWorkspaceMembers(open ? wsId : null);
   const setMembers = useSetWorkspaceMembers(wsId);
   const [query, setQuery] = useState('');
   const [checkedIds, setCheckedIds] = useState<number[]>([]);

   const members = useMemo(() => data?.members || [], [data]);

   // Seed the working set from members that currently have access whenever the modal opens.
   useEffect(() => {
      if (!open) return;
      setCheckedIds(members.filter((m) => m.hasAccess).map((m) => m.id));
      setQuery('');
   }, [open, members]);

   if (!open) return null;

   const filtered = members.filter((m) => (m.email || '').toLowerCase().includes(query.trim().toLowerCase()));
   const toggleableRows = filtered.filter((m) => !isManager(m.role));
   const allToggleableChecked = toggleableRows.length > 0 && toggleableRows.every((m) => checkedIds.includes(m.id));

   const isChecked = (m: WorkspaceMemberRow) => isManager(m.role) || checkedIds.includes(m.id);

   const toggleRow = (id: number) => setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

   const toggleAll = () => {
      const ids = toggleableRows.map((m) => m.id);
      setCheckedIds((prev) => (allToggleableChecked ? prev.filter((x) => !ids.includes(x)) : Array.from(new Set([...prev, ...ids]))));
   };

   const onSave = () => {
      // Owners/admins are always included server-side, but send the union to keep intent explicit.
      const managerIds = members.filter((m) => isManager(m.role)).map((m) => m.id);
      const memberIds = Array.from(new Set([...managerIds, ...checkedIds]));
      setMembers.mutate({ memberIds }, {
         onSuccess: () => { toast.success('Members updated'); onClose(); },
         onError: (e) => { toast.error(e instanceof Error ? e.message : 'Something went wrong'); } });
   };

   // The Koala Modal owns the shell — portal, overlay, Esc, scroll-lock, header + close X.
   return (
      <Modal title="Manage workspace members" onClose={onClose} width={560}>
         <ModalBody>
            <div style={{ marginBottom: 12 }}>
               <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by email…"
                  style={{ width: '100%' }}
               />
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
               <colgroup>
                  <col style={{ width: 48 }} /><col /><col style={{ width: '24%' }} />
               </colgroup>
               <thead>
                  <tr style={{ borderBottom: '1px solid var(--koala-border-primary)' }}>
                     <th style={{ ...thStyle, textAlign: 'center' }}>
                        <Checkbox checked={allToggleableChecked} disabled={toggleableRows.length === 0} onChange={() => toggleAll()} size="sm" />
                     </th>
                     <th style={thStyle}>Member</th>
                     <th style={thStyle}>Role</th>
                  </tr>
               </thead>
               <tbody>
                  {filtered.length === 0 && (
                     <tr><td style={{ padding: '14px 16px', fontSize: 14, color: 'var(--koala-text-secondary)', fontFamily: font }} colSpan={3}>No members found.</td></tr>
                  )}
                  {filtered.map((m) => {
                     const email = m.email || '—';
                     const manager = isManager(m.role);
                     return (
                        <tr key={m.id} style={{ borderTop: '1px solid var(--koala-border-primary)' }}>
                           <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <Checkbox checked={isChecked(m)} disabled={manager} onChange={() => toggleRow(m.id)} size="sm" />
                           </td>
                           <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                 <Avatar initial={(email[0] || '?').toUpperCase()} />
                                 <span style={{ fontSize: 14, color: 'var(--koala-text-primary)', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
                              </div>
                           </td>
                           <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--koala-text-secondary)', fontFamily: font }}>{cap(m.role)}</td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </ModalBody>

         <ModalFooter>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" busy={setMembers.isLoading} disabled={setMembers.isLoading} onClick={onSave}>
               Save
            </Button>
         </ModalFooter>
      </Modal>
   );
};

export default ManageMembersModal;
