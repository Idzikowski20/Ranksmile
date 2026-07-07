import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Input } from '../core';
import { SentrySettingsSection, SentrySettingsRow } from '../sentry-pages';

const PencilIcon = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path
      fill="currentColor"
      d="m2.695 14.762l-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.886L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.419a4 4 0 0 0-.885 1.343"
    />
  </svg>
);

const InfoIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style={{ flexShrink: 0, color: '#9F9FA9' }}>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      d="m11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0m-9-3.75h.008v.008H12z"
    />
  </svg>
);

const VisaLogo = () => (
  <svg width="56" height="40" viewBox="0 0 34 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <rect x="0.5" y="0.5" width="33" height="23" rx="3.5" fill="white" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.7503 15.8579H8.69056L7.146 9.79198C7.07269 9.51295 6.91703 9.26627 6.68806 9.15001C6.11664 8.85784 5.48696 8.62531 4.80005 8.50804V8.2745H8.11813C8.57607 8.2745 8.91953 8.62531 8.97677 9.03274L9.77817 13.4083L11.8369 8.2745H13.8394L10.7503 15.8579ZM14.9843 15.8579H13.039L14.6408 8.2745H16.5861L14.9843 15.8579ZM19.1028 10.3753C19.16 9.96689 19.5035 9.73335 19.9042 9.73335C20.5338 9.67471 21.2197 9.79199 21.7922 10.0832L22.1356 8.45042C21.5632 8.21688 20.9335 8.09961 20.3621 8.09961C18.4741 8.09961 17.1003 9.15002 17.1003 10.6078C17.1003 11.7169 18.0734 12.2992 18.7603 12.65C19.5035 12.9998 19.7897 13.2334 19.7324 13.5832C19.7324 14.1079 19.16 14.3414 18.5886 14.3414C17.9017 14.3414 17.2147 14.1665 16.5861 13.8743L16.2426 15.5081C16.9295 15.7992 17.6727 15.9165 18.3596 15.9165C20.4766 15.9741 21.7922 14.9247 21.7922 13.3496C21.7922 11.3661 19.1028 11.2498 19.1028 10.3753ZM28.6 15.8579L27.0555 8.2745H25.3965C25.053 8.2745 24.7095 8.50804 24.5951 8.85784L21.7349 15.8579H23.7374L24.1371 14.7498H26.5976L26.8265 15.8579H28.6ZM25.6827 10.3164L26.2541 13.1744H24.6523L25.6827 10.3164Z"
      fill="#172B85"
    />
    <rect x="0.5" y="0.5" width="33" height="23" rx="3.5" stroke="#EDF2F7" />
  </svg>
);

const StripeSeal = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" fill="#1AB25E" />
    <path d="M8 12.2l2.6 2.6L16 9.4" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const font = 'var(--font-family-primary)';

const EditButton = ({ onClick }: { onClick: () => void }) => (
  <Button type="button" variant="transparent" size="sm" icon={<PencilIcon />} onClick={onClick}>
    Edit
  </Button>
);

const SaveCancel = ({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <Button type="button" variant="transparent" size="sm" onClick={onCancel}>Cancel</Button>
    <Button type="button" variant="secondary" size="sm" onClick={onSave}>Save</Button>
  </div>
);

const ReadField = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontFamily: font, fontSize: 14, color: '#18181B' }}>{label}</span>
    <span style={{ fontFamily: font, fontSize: 14, fontWeight: 500, color: '#09090B' }}>{value}</span>
  </div>
);

const TaxIdRow = ({ withEdit, onEdit }: { withEdit?: boolean; onEdit?: () => void }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontFamily: font, fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>Tax ID</span>
      <InfoIcon />
    </div>
    {withEdit && onEdit && <EditButton onClick={onEdit} />}
  </div>
);

const BillingDetailsSettings = () => {
  const [editPayment, setEditPayment] = useState(false);
  const [editCustomer, setEditCustomer] = useState(false);

  const savePayment = () => { setEditPayment(false); toast.success('Payment method updated'); };
  const saveCustomer = () => { setEditCustomer(false); toast.success('Customer details updated'); };

  return (
    <>
      <SentrySettingsSection title="Payment method">
        <SentrySettingsRow
          label="Card on file"
          description="Your default payment method for subscription renewals."
        >
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: editPayment ? 16 : 0 }}>
              {editPayment
                ? <SaveCancel onCancel={() => setEditPayment(false)} onSave={savePayment} />
                : <EditButton onClick={() => setEditPayment(true)} />}
            </div>
            {editPayment ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontFamily: font, fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>Cardholder Name</label>
                  <Input placeholder="e.g. John Doe" style={{ width: '100%', maxWidth: 320 }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontFamily: font, fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>Card Number</label>
                  <div style={{ position: 'relative', maxWidth: 320 }}>
                    <Input placeholder="Card Number" style={{ width: '100%' }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none' }}>
                      <VisaLogo />
                    </span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, maxWidth: 320 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontFamily: font, fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>Expiration Date</label>
                    <Input placeholder="MM/YY" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontFamily: font, fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>CVC</label>
                    <Input placeholder="CVC" />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StripeSeal />
                  <span style={{ fontFamily: font, fontSize: 14, color: '#3F3F47' }}>
                    Secure payment powered by{' '}
                    <Button type="button" variant="link" size="sm" onClick={() => toast('Powered by Stripe')} style={{ padding: 0, verticalAlign: 'baseline' }}>
                      Stripe
                    </Button>
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <VisaLogo />
                <span style={{ fontFamily: font, fontSize: 14, color: '#18181B', fontVariantNumeric: 'tabular-nums slashed-zero' }}>
                  <span style={{ paddingRight: 4, letterSpacing: '0.05em' }}>•••• •••• ••••</span>
                  5948
                </span>
                <span style={{ fontFamily: font, fontSize: 14, paddingLeft: 8, fontVariantNumeric: 'tabular-nums slashed-zero' }}>
                  <span style={{ color: '#52525C' }}>Exp:</span> 4/2031
                </span>
              </div>
            )}
          </div>
        </SentrySettingsRow>
      </SentrySettingsSection>

      <SentrySettingsSection title="Customer details">
        <SentrySettingsRow label="Billing information" description="Address and tax details used on invoices.">
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: editCustomer ? 16 : 0 }}>
              {editCustomer
                ? <SaveCancel onCancel={() => setEditCustomer(false)} onSave={saveCustomer} />
                : <EditButton onClick={() => setEditCustomer(true)} />}
            </div>
            {editCustomer ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontFamily: font, fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>Country</label>
                  <div style={{ width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8F8F9', border: '1px solid #E4E4E7', borderRadius: 8, padding: '10px 12px', fontFamily: font, fontSize: 14, color: '#9F9FA9' }}>
                    <span>Poland</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M6 9l6 6 6-6" stroke="#9F9FA9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontFamily: font, fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>Billing email (optional)</label>
                  <Input defaultValue="patryk.idzikowski@interia.pl" style={{ width: '100%' }} />
                  <span style={{ fontFamily: font, fontSize: 13, color: '#52525C' }}>Fill in to receive invoices on an email address other than the one associated with your account</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontFamily: font, fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>Name/Company name</label>
                  <Input style={{ width: '100%' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontFamily: font, fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>Address</label>
                  <Input style={{ width: '100%' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontFamily: font, fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>City</label>
                  <Input style={{ width: '100%' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontFamily: font, fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>State/Province/Region</label>
                    <Input />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontFamily: font, fontSize: 14, fontWeight: 500, color: '#3F3F47' }}>ZIP Code</label>
                    <Input />
                  </div>
                </div>
                <TaxIdRow withEdit onEdit={() => toast('Add your Tax ID')} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <ReadField label="Country" value="Poland" />
                <ReadField label="Billing email" value="patryk.idzikowski@interia.pl" />
                <TaxIdRow />
              </div>
            )}
          </div>
        </SentrySettingsRow>
      </SentrySettingsSection>
    </>
  );
};

export default BillingDetailsSettings;
