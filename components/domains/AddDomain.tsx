import React, { useEffect, useState } from 'react';
import { ShellPortal, overlayZ } from '../koala/overlay/ShellPortal';
import { useAddDomain } from '../../services/domains';
import { isValidUrl } from '../../utils/client/validators';

type AddDomainProps = {
   domains: DomainType[];
   closeModal: Function;
};

const AddDomain = ({ closeModal, domains = [] }: AddDomainProps) => {
   const [newDomain, setNewDomain] = useState<string>('');
   const [newDomainError, setNewDomainError] = useState('');
   const { mutate: addMutate, isLoading: isAdding } = useAddDomain(() => closeModal());

   /* close on Escape */
   useEffect(() => {
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(false); };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
   }, [closeModal]);

   const addDomain = () => {
      setNewDomainError('');
      const existingDomains = domains.map((d) => d.domain);
      const insertedURLs = newDomain.split('\n');
      const domainsTobeAdded: string[] = [];
      const invalidDomains: string[] = [];

      insertedURLs.forEach((url) => {
         const theURL = url.trim();
         if (!theURL) return;
         if (isValidUrl(theURL)) {
            const domURL = new URL(theURL);
            const isDomain = domURL.pathname === '/';
            if (isDomain && !existingDomains.includes(domURL.host)) {
               domainsTobeAdded.push(domURL.host);
            }
            if (!isDomain && !existingDomains.includes(domURL.href)) {
               const cleanedURL = domURL.href.replace('https://', '').replace('http://', '').replace(/^\/+|\/+$/g, '');
               domainsTobeAdded.push(cleanedURL);
            }
         } else {
            invalidDomains.push(theURL);
         }
      });

      if (invalidDomains.length > 0) {
         setNewDomainError(`Invalid URL${invalidDomains.length > 1 ? 's' : ''}: ${invalidDomains.join(', ')}`);
      } else if (domainsTobeAdded.length > 0) {
         addMutate(domainsTobeAdded);
      }
   };

   const handleDomainInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (e.currentTarget.value === '' && newDomainError) setNewDomainError('');
      setNewDomain(e.currentTarget.value);
   };

   return (
      <ShellPortal>
      <div
         style={{
            position: 'fixed',
            inset: 0,
            zIndex: overlayZ.modal,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
         }}
         onClick={(e) => { if (e.target === e.currentTarget) closeModal(false); }}
      >
         {/* Panel */}
         <div
            data-testid="adddomain_modal"
            style={{
               width: 440,
               maxWidth: 'calc(100vw - 32px)',
               background: 'var(--color-surface-strong, #09090b)',
               border: '1px solid var(--color-border-strong, #221e28)',
               borderRadius: 'var(--radius-md, 14px)',
               boxShadow: 'rgba(0,0,0,0.4) 0px 8px 40px 0px',
               padding: '24px',
               display: 'flex',
               flexDirection: 'column',
               gap: '20px',
               position: 'relative',
            }}
         >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
               <span
                  style={{
                     fontSize: 15,
                     fontWeight: 600,
                     color: 'var(--color-text-primary, #fff)',
                     fontFamily: 'var(--font-family-primary)',
                     lineHeight: '22px',
                  }}
               >
                  Add New Domain
               </span>
               <button
                  onClick={() => closeModal(false)}
                  style={{
                     background: 'transparent',
                     border: 'none',
                     cursor: 'pointer',
                     padding: 4,
                     borderRadius: 6,
                     color: 'rgba(255,255,255,0.35)',
                     display: 'flex',
                     alignItems: 'center',
                     transition: 'color var(--motion-fast, 200ms)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)'; }}
                  aria-label="Close"
               >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                     <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
               </button>
            </div>

            {/* Body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
               <label
                  style={{
                     fontSize: 12,
                     fontWeight: 600,
                     color: 'rgba(255,255,255,0.45)',
                     fontFamily: 'var(--font-family-primary)',
                     letterSpacing: '0.05em',
                     textTransform: 'uppercase',
                  }}
               >
                  Website URL(s)
               </label>
               <textarea
                  autoFocus
                  value={newDomain}
                  onChange={handleDomainInput}
                  placeholder={'https://mysite.com/\nhttps://anothersite.com/'}
                  rows={5}
                  style={{
                     width: '100%',
                     padding: '10px 12px',
                     border: `1px solid ${newDomainError ? '#f87171' : 'var(--color-border-strong, #221e28)'}`,
                     borderRadius: 'var(--radius-xs, 7px)',
                     background: 'rgba(255,255,255,0.04)',
                     color: 'var(--color-text-primary, #fff)',
                     fontSize: 13,
                     fontFamily: 'var(--font-family-primary)',
                     lineHeight: '20px',
                     outline: 'none',
                     resize: 'vertical',
                     transition: 'border-color 200ms',
                  }}
                  onFocus={(e) => {
                     if (!newDomainError) e.currentTarget.style.borderColor = 'rgba(242,153,100,0.6)';
                  }}
                  onBlur={(e) => {
                     if (!newDomainError) e.currentTarget.style.borderColor = 'var(--color-border-strong, #221e28)';
                  }}
               />
               {newDomainError && (
                  <span
                     style={{
                        fontSize: 12,
                        color: '#f87171',
                        fontFamily: 'var(--font-family-primary)',
                        lineHeight: '16px',
                     }}
                  >
                     {newDomainError}
                  </span>
               )}
               <span
                  style={{
                     fontSize: 12,
                     color: 'rgba(255,255,255,0.25)',
                     fontFamily: 'var(--font-family-primary)',
                     lineHeight: '16px',
                  }}
               >
                  Enter each URL on a new line.
               </span>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
               <button
                  onClick={() => closeModal(false)}
                  style={{
                     padding: '7px 16px',
                     borderRadius: 'var(--radius-xs, 7px)',
                     border: '1px solid var(--color-border-strong, #221e28)',
                     background: 'transparent',
                     color: 'rgba(255,255,255,0.55)',
                     fontSize: 13,
                     fontWeight: 500,
                     fontFamily: 'var(--font-family-primary)',
                     cursor: 'pointer',
                     transition: 'background 200ms, color 200ms',
                  }}
                  onMouseEnter={(e) => {
                     (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
                     (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)';
                  }}
                  onMouseLeave={(e) => {
                     (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                     (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)';
                  }}
               >
                  Cancel
               </button>
               <button
                  onClick={() => !isAdding && addDomain()}
                  disabled={isAdding}
                  style={{
                     padding: '7px 20px',
                     borderRadius: 'var(--radius-xs, 7px)',
                     border: 'none',
                     background: 'var(--color-surface-raised, #F84416)',
                     color: '#fff',
                     fontSize: 13,
                     fontWeight: 600,
                     fontFamily: 'var(--font-family-primary)',
                     cursor: isAdding ? 'not-allowed' : 'pointer',
                     opacity: isAdding ? 0.7 : 1,
                     transition: 'background 200ms, opacity 200ms',
                     boxShadow: 'rgba(0,0,0,0.2) 0px -1px 0px 0px inset, rgba(255,255,255,0.25) 0px 1px 0px 0px inset',
                  }}
                  onMouseEnter={(e) => {
                     if (!isAdding) (e.currentTarget as HTMLButtonElement).style.background = '#6b2fe0';
                  }}
                  onMouseLeave={(e) => {
                     (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-raised, #F84416)';
                  }}
               >
                  {isAdding ? 'Adding...' : 'Add Domain'}
               </button>
            </div>
         </div>
      </div>
      </ShellPortal>
   );
};

export default AddDomain;
