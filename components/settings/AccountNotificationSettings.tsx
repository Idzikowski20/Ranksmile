import React, { useState } from 'react';
import { useProfile, useUpdateProfile } from '../../services/profile';

const font = 'var(--font-family-primary)';

/** Your account → Notifications: a single per-user product-updates opt-in (Surfer parity). */
const AccountNotificationSettings = () => {
   const { data: profile } = useProfile();
   const updateProfile = useUpdateProfile();
   const [pending, setPending] = useState<boolean | null>(null);
   const checked = pending !== null ? pending : !!profile?.productUpdates;

   const toggle = () => {
      const next = !checked;
      setPending(next);
      updateProfile.mutate({ productUpdates: next }, { onSettled: () => setPending(null) });
   };

   return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: font }}>
         <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label="Get product updates, educational resources, and live event info"
            onClick={toggle}
            style={{
               width: 36, height: 20, flexShrink: 0, padding: 0, border: 'none', borderRadius: 9999, position: 'relative',
               cursor: 'pointer', background: checked ? '#783AFB' : '#D4D4D8', transition: 'background 200ms ease',
            }}
         >
            <span style={{ position: 'absolute', top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: 9999, background: '#fff', transition: 'left 200ms ease', boxShadow: '0 1px 3px rgba(24,26,34,0.2)' }} />
         </button>
         <span style={{ fontSize: 14, color: '#18181B' }}>Get product updates, educational resources, and live event info</span>
      </div>
   );
};

export default AccountNotificationSettings;
