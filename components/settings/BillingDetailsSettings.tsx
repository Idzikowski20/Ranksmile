import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { BillingSnapshot } from '../../lib/billing/buildBillingSnapshot';
import type { BillingErrorBody } from '../../lib/billing/billingErrors';
import type {
  PaymentMethodRole,
  PaymentMethodViewModel,
} from '../../lib/billing/paymentMethodViewModel';
import { Badge, Button } from '../koala/core';
import { KoalaSettingsSection, KoalaSettingsRow } from '../koala/layout';

const font = 'var(--font-family-primary)';

const ROLE_LABEL: Record<PaymentMethodRole, string> = {
  default: 'Default',
  trial_card: 'Trial',
  backup: 'Backup',
  expired: 'Expired',
  orphan: 'Orphan',
};

const ROLE_APPEARANCE: Record<PaymentMethodRole, 'brand' | 'info' | 'muted' | 'warning' | 'danger'> = {
  default: 'brand',
  trial_card: 'info',
  backup: 'muted',
  expired: 'warning',
  orphan: 'danger',
};

function brandLabel(brand: string): string {
  if (!brand) return 'Card';
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

function expLabel(pm: PaymentMethodViewModel): string {
  if (pm.expMonth == null || pm.expYear == null) return '—';
  return `${pm.expMonth}/${pm.expYear}`;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json() as BillingErrorBody & { error?: string };
    if (body.message) return body.message;
    if (typeof body.error === 'string') return body.error;
  } catch {
    /* ignore */
  }
  return 'Something went wrong';
}

const BillingDetailsSettings = () => {
  const [snapshot, setSnapshot] = useState<BillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/snapshot');
      if (!res.ok) {
        toast.error(await readError(res));
        setSnapshot(null);
        return;
      }
      const data = await res.json() as BillingSnapshot;
      setSnapshot(data);
    } catch {
      toast.error('Failed to load billing snapshot');
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setDefault = async (pm: PaymentMethodViewModel) => {
    if (!pm.capabilities.canSetDefault) return;
    setBusyId(pm.id);
    try {
      const res = await fetch(`/api/billing/payment-methods/${encodeURIComponent(pm.id)}/default`, {
        method: 'POST',
      });
      if (!res.ok) {
        toast.error(await readError(res));
        return;
      }
      toast.success('Default payment method updated');
      await load();
    } catch {
      toast.error('Failed to set default');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (pm: PaymentMethodViewModel) => {
    if (!pm.capabilities.canDelete) return;
    setBusyId(pm.id);
    try {
      const res = await fetch(`/api/billing/payment-methods/${encodeURIComponent(pm.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast.error(await readError(res));
        return;
      }
      toast.success('Payment method removed');
      await load();
    } catch {
      toast.error('Failed to remove payment method');
    } finally {
      setBusyId(null);
    }
  };

  const methods = snapshot?.paymentMethods ?? [];
  const email = snapshot?.customer.email;

  return (
    <>
      <KoalaSettingsSection title="Payment method">
        <KoalaSettingsRow
          label="Cards on file"
          description="Default and backup methods for trial and renewals. Data from Billing Snapshot."
        >
          <div style={{ width: '100%' }}>
            {loading && (
              <span style={{ fontFamily: font, fontSize: 14, color: 'var(--koala-text-secondary)' }}>
                Loading…
              </span>
            )}
            {!loading && methods.length === 0 && (
              <span style={{ fontFamily: font, fontSize: 14, color: 'var(--koala-text-secondary)' }}>
                No payment methods on file. Start a trial from checkout to add a card.
              </span>
            )}
            {!loading && methods.length > 0 && (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {methods.map((pm) => {
                  const busy = busyId === pm.id;
                  return (
                    <li
                      key={pm.id}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                        border: '1px solid var(--koala-border-primary)',
                        borderRadius: 12,
                        background: 'var(--koala-bg-primary)',
                      }}
                    >
                      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: font, fontSize: 14, fontWeight: 500, color: 'var(--koala-text-primary)' }}>
                            {brandLabel(pm.brand)}
                          </span>
                          <span
                            style={{
                              fontFamily: font,
                              fontSize: 14,
                              color: 'var(--koala-text-primary)',
                              fontVariantNumeric: 'tabular-nums slashed-zero',
                            }}
                          >
                            •••• {pm.last4}
                          </span>
                          <span style={{ fontFamily: font, fontSize: 13, color: 'var(--koala-text-secondary)' }}>
                            Exp {expLabel(pm)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                          {pm.roles.map((role) => (
                            <Badge key={role} appearance={ROLE_APPEARANCE[role]} size="sm">
                              {ROLE_LABEL[role]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy || !pm.capabilities.canSetDefault}
                          onClick={() => void setDefault(pm)}
                        >
                          Set default
                        </Button>
                        <Button
                          type="button"
                          variant="transparent"
                          size="sm"
                          disabled={busy || !pm.capabilities.canDelete}
                          onClick={() => void remove(pm)}
                        >
                          Remove
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </KoalaSettingsRow>
      </KoalaSettingsSection>

      <KoalaSettingsSection title="Customer details">
        <KoalaSettingsRow label="Billing contact" description="Email on the Stripe customer from the snapshot.">
          <div style={{ width: '100%' }}>
            {loading ? (
              <span style={{ fontFamily: font, fontSize: 14, color: 'var(--koala-text-secondary)' }}>Loading…</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: font, fontSize: 14, color: 'var(--koala-text-primary)' }}>Billing email</span>
                <span style={{ fontFamily: font, fontSize: 14, fontWeight: 500, color: 'var(--koala-text-primary)' }}>
                  {email || '—'}
                </span>
              </div>
            )}
          </div>
        </KoalaSettingsRow>
      </KoalaSettingsSection>
    </>
  );
};

export default BillingDetailsSettings;
