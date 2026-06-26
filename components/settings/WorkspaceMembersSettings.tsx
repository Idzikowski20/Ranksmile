import React, { useState } from 'react';
import { useWorkspaces } from '../../services/workspaces';
import { useWorkspaceMembers } from '../../services/workspaceMembers';
import ManageMembersModal from './ManageMembersModal';

const font = 'var(--font-family-primary)';
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const thStyle: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: '#71717A', fontFamily: font };
const tableShell: React.CSSProperties = { width: '100%', border: '1px solid #F4F4F5', borderRadius: 12, background: '#FFFFFF', overflow: 'hidden' };

const Avatar = ({ initial }: { initial: string }) => (
   <div style={{ width: 32, height: 32, borderRadius: 9999, background: 'rgba(120,58,251,0.12)', color: '#783AFB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0, fontFamily: font }}>
      {initial}
   </div>
);

const Separator = () => <div role="separator" style={{ minHeight: 1, minWidth: 1, alignSelf: 'stretch', background: '#F4F4F5' }} />;

const WorkspaceMembersSettings = () => {
   const { data: wsData } = useWorkspaces();
   const workspaces = wsData?.workspaces || [];
   const current = workspaces.find((w) => w.id === wsData?.activeId) || workspaces[0];
   const wsId = current?.id ?? null;
   const workspaceName = current?.name || 'this';

   const { data, isLoading } = useWorkspaceMembers(wsId);
   const [modalOpen, setModalOpen] = useState(false);

   const accessMembers = (data?.members || []).filter((m) => m.hasAccess);

   return (
      <div className="flex w-full flex-col items-start gap-base">
         <div style={{ display: 'flex', width: '100%', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div className="gap-2xs flex flex-col">
               <span className="text-base font-semibold text-gray-140">Members</span>
               <span className="text-md font-normal text-gray-100">Manage who has access to {workspaceName} workspace</span>
            </div>
            <button
               type="button"
               onClick={() => setModalOpen(true)}
               disabled={wsId === null}
               style={{ flexShrink: 0, height: 40, padding: '0 16px', borderRadius: 8, border: 'none', background: '#2F2F34', color: '#FFFFFF', fontSize: 14, fontWeight: 600, fontFamily: font, cursor: wsId === null ? 'default' : 'pointer', opacity: wsId === null ? 0.6 : 1, transition: 'background 150ms ease' }}
               onMouseEnter={(e) => { if (wsId !== null) e.currentTarget.style.background = '#783AFB'; }}
               onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
            >
               Manage
            </button>
         </div>

         <Separator />

         <div style={tableShell}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
               <colgroup>
                  <col style={{ width: '56%' }} /><col style={{ width: '24%' }} /><col style={{ width: '20%' }} />
               </colgroup>
               <thead>
                  <tr style={{ borderBottom: '1px solid #F4F4F5' }}>
                     <th style={thStyle}>Member</th>
                     <th style={thStyle}>Role</th>
                     <th style={{ padding: '10px 16px' }} />
                  </tr>
               </thead>
               <tbody>
                  {isLoading && <tr><td style={{ padding: '12px 16px', fontSize: 14, color: '#52525C', fontFamily: font }} colSpan={3}>Loading…</td></tr>}
                  {!isLoading && accessMembers.length === 0 && <tr><td style={{ padding: '12px 16px', fontSize: 14, color: '#52525C', fontFamily: font }} colSpan={3}>No members have access yet.</td></tr>}
                  {accessMembers.map((m) => {
                     const email = m.email || '—';
                     return (
                        <tr key={m.id} style={{ borderTop: '1px solid #F4F4F5' }}>
                           <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                 <Avatar initial={(email[0] || '?').toUpperCase()} />
                                 <span style={{ fontSize: 14, color: '#18181B', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
                              </div>
                           </td>
                           <td style={{ padding: '12px 16px', fontSize: 14, color: '#52525C', fontFamily: font }}>{cap(m.role)}</td>
                           <td style={{ padding: '12px 16px' }} />
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>

         {wsId !== null && (
            <ManageMembersModal wsId={wsId} open={modalOpen} onClose={() => setModalOpen(false)} />
         )}
      </div>
   );
};

export default WorkspaceMembersSettings;
