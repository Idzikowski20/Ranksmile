/**
 * One analysis per domain: while the setup pipeline or an AI Visibility scan holds the
 * domain, content creation and the other pipeline get a 409 instead of racing it.
 */
/* eslint-disable import/first -- jest.mock must precede the imports it stubs */
jest.mock('@/database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('sequelize', () => ({ QueryTypes: { SELECT: 'SELECT' } }));

import type { NextApiResponse } from 'next';
import db from '@/database/database';
import { domainBusyReason, rejectIfDomainBusy } from '@/src/infrastructure/cron/domainLock';

const query = db.query as jest.Mock;

function res() {
  const r = { status: jest.fn(), json: jest.fn(), _code: 0, _body: null as unknown };
  r.status.mockImplementation((c: number) => { r._code = c; return r; });
  r.json.mockImplementation((b: unknown) => { r._body = b; return r; });
  return r as unknown as NextApiResponse & { _code: number; _body: unknown };
}

/** First call answers the setup-job lookup, second the scan lookup. */
function state(setup: string | null, scanActive: boolean) {
  query.mockReset();
  query
    .mockResolvedValueOnce(setup ? [{ status: setup }] : [])
    .mockResolvedValueOnce(scanActive ? [{ id: 1 }] : []);
}

describe('domainBusyReason', () => {
  it('is the setup pipeline while its job is queued, running or finalizing', async () => {
    for (const s of ['queued', 'running', 'finalizing']) {
      state(s, false);
      expect(await domainBusyReason(3)).toBe('domain_setup');
    }
  });

  it('is the AI Visibility scan while one is active', async () => {
    state('done', true);
    expect(await domainBusyReason(3)).toBe('ai_visibility_scan');
  });

  it('is free once the job is done or failed and no scan runs', async () => {
    state('done', false);
    expect(await domainBusyReason(3)).toBeNull();
    state('failed', false);
    expect(await domainBusyReason(3)).toBeNull();
    state(null, false);
    expect(await domainBusyReason(3)).toBeNull();
  });
});

describe('rejectIfDomainBusy', () => {
  it('answers 409 with the reason and a message the UI can show', async () => {
    state('running', false);
    const r = res();
    expect(await rejectIfDomainBusy(r, 3)).toBe(true);
    expect(r._code).toBe(409);
    expect(r._body).toMatchObject({ error: 'DOMAIN_BUSY', reason: 'domain_setup' });
  });

  it('lets the request through when the domain is free', async () => {
    state('done', false);
    const r = res();
    expect(await rejectIfDomainBusy(r, 3)).toBe(false);
    expect(r.status).not.toHaveBeenCalled();
  });

  it('can check one pipeline only — run-setup is blocked by a scan, not by itself', async () => {
    query.mockReset();
    query.mockResolvedValueOnce([{ id: 1 }]);
    const r = res();
    expect(await rejectIfDomainBusy(r, 3, 'ai_visibility_scan')).toBe(true);
    expect(r._body).toMatchObject({ reason: 'ai_visibility_scan' });
  });
});
