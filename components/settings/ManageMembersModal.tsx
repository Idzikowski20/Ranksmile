import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import useOnKey from '../../hooks/useOnKey';
import { Checkbox } from '../koala/core';
import { ShellPortal, overlayZ } from '../koala/overlay/ShellPortal';
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

   useOnKey('Escape', onClose);

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

   const closeOnBGClick = (e: React.SyntheticEvent) => {
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      if (e.target === e.currentTarget) onClose();
   };

   return (
      <ShellPortal>
      <div
         onClick={closeOnBGClick}
         style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: overlayZ.modal, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}
      >
         <div style={{ maxWidth: 560, width: 'calc(100vw - 2rem)', background: 'var(--koala-bg-primary)', borderRadius: 16, padding: 24, position: 'relative', marginTop: '10vh', boxShadow: '0px 18px 40px 0px rgba(17,24,39,0.14), 0px 8px 18px 0px rgba(17,24,39,0.09), 0px 2px 6px 0px rgba(17,24,39,0.06)', animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)', fontFamily: font }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--koala-text-primary)', marginBottom: 16, marginTop: 0 }}>Manage workspace members</h3>
            <button
               type="button"
               aria-label="Close"
               onClick={onClose}
               style={{ position: 'absolute', right: 12, top: 12, padding: 8, cursor: 'pointer', color: 'var(--koala-text-tertiary)', background: 'none', border: 'none', transition: 'color 150ms ease, transform 150ms ease' }}
               onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--koala-text-primary)'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
               onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--koala-text-tertiary)'; e.currentTarget.style.transform = 'rotate(0deg)'; }}
            >
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
               </svg>
            </button>

            <input
               type="text"
               value={query}
               onChange={(e) => setQuery(e.target.value)}
               placeholder="Search by email…"
               style={{ width: '100%', height: 40, border: '1px solid var(--koala-border-primary)', borderRadius: 8, padding: '0 12px', fontSize: 14, color: 'var(--koala-text-primary)', background: 'var(--koala-bg-primary)', fontFamily: font, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
               onFocus={(e) => { e.currentTarget.style.borderColor = '#F9A08D'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(248,68,22,0.1)'; }}
               onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--koala-border-primary)'; e.currentTarget.style.boxShadow = 'none'; }}
            />

            <div style={{ overflow: 'hidden', background: 'var(--koala-bg-primary)' }}>
               <div style={{ maxHeight: 300, overflowY: 'auto' }}>
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
               </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
               <button
                  type="button"
                  onClick={onClose}
                  style={{ height: 40, padding: '0 16px', borderRadius: 8, border: '1px solid var(--koala-border-primary)', background: 'var(--koala-bg-primary)', color: 'var(--koala-text-secondary)', fontSize: 14, fontWeight: 600, fontFamily: font, cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--koala-bg-secondary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--koala-bg-primary)'; }}
               >
                  Cancel
               </button>
               <button
                  type="button"
                  onClick={onSave}
                  disabled={setMembers.isLoading}
                  style={{ height: 40, padding: '0 16px', borderRadius: 8, border: 'none', background: 'var(--koala-bg-inverse)', color: 'var(--koala-bg-primary)', fontSize: 14, fontWeight: 600, fontFamily: font, cursor: 'pointer', opacity: setMembers.isLoading ? 0.7 : 1, transition: 'background 150ms ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--koala-brand)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--koala-bg-inverse)'; }}
               >
                  {setMembers.isLoading ? 'Saving…' : 'Save'}
               </button>
            </div>
         </div>
      </div>
      </ShellPortal>
   );
};

export default ManageMembersModal;
