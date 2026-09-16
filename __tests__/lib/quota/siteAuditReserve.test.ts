import {
  reserveSiteAuditRun,
  closeSiteAuditRun,
  releaseSiteAuditRun,
  siteAuditIdempotencyKey,
} from '@/src/infrastructure/quota/siteAudit';
import {
  getOrgIdForDomain,
  ensureOrgQuotaBalances,
  findReservationByIdempotency,
  findActiveReservationByRef,
  reserveQuota,
  closePerRunReservation,
  releaseReservation,
} from '@/src/infrastructure/quota/index';

jest.mock('@/src/infrastructure/quota/index', () => ({
  getOrgIdForDomain: jest.fn(),
  ensureOrgQuotaBalances: jest.fn().mockResolvedValue(undefined),
  findReservationByIdempotency: jest.fn(),
  findActiveReservationByRef: jest.fn(),
  reserveQuota: jest.fn(),
  closePerRunReservation: jest.fn(),
  releaseReservation: jest.fn(),
}));
jest.mock('@/src/infrastructure/billing/orgBilling', () => ({ getOrgBillingState: jest.fn().mockResolvedValue({ planSlug: 'growth' }) }));
jest.mock('@/src/infrastructure/billing/planLimits', () => ({ getSiteAuditPageLimit: () => 100, resolvePlanSlug: (s: string) => s }));

const mocked = {
  getOrgIdForDomain: getOrgIdForDomain as jest.Mock,
  findReservationByIdempotency: findReservationByIdempotency as jest.Mock,
  findActiveReservationByRef: findActiveReservationByRef as jest.Mock,
  reserveQuota: reserveQuota as jest.Mock,
  closePerRunReservation: closePerRunReservation as jest.Mock,
  releaseReservation: releaseReservation as jest.Mock,
};

beforeEach(() => {
  jest.clearAllMocks();
  mocked.getOrgIdForDomain.mockResolvedValue(7);
});

it('keys the reservation per run so a rerun re-checks the plan limit', () => {
  expect(siteAuditIdempotencyKey('dsetup_3', 'run-abc')).toBe('site-audit:dsetup_3:run-abc');
});

it('reserves under the per-run key, not a stable per-job key', async () => {
  mocked.findReservationByIdempotency.mockResolvedValue(undefined);
  mocked.reserveQuota.mockResolvedValue({ id: 42 });
  await reserveSiteAuditRun(3, 'dsetup_3', 'run-abc', 'u1');
  expect(mocked.findReservationByIdempotency).toHaveBeenCalledWith(7, 'site-audit:dsetup_3:run-abc');
  expect(mocked.reserveQuota).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'site-audit:dsetup_3:run-abc' }));
});

it('closes the active reservation found by ref, not by the per-run key', async () => {
  mocked.findActiveReservationByRef.mockResolvedValue({ id: 9, status: 'reserved' });
  await closeSiteAuditRun(3, 'dsetup_3');
  expect(mocked.findActiveReservationByRef).toHaveBeenCalledWith(7, 'domain_setup', 'dsetup_3');
  expect(mocked.closePerRunReservation).toHaveBeenCalledWith(9);
});

it('releases the active reservation found by ref', async () => {
  mocked.findActiveReservationByRef.mockResolvedValue({ id: 9, status: 'reserved' });
  await releaseSiteAuditRun(3, 'dsetup_3');
  expect(mocked.releaseReservation).toHaveBeenCalledWith(9);
});

it('is a no-op on close when there is no active reservation', async () => {
  mocked.findActiveReservationByRef.mockResolvedValue(undefined);
  await closeSiteAuditRun(3, 'dsetup_3');
  expect(mocked.closePerRunReservation).not.toHaveBeenCalled();
});
