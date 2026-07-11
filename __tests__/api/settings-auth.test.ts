import type { NextApiRequest, NextApiResponse } from 'next';
import settingsHandler from '../../pages/api/settings';
import verifyUser from '../../utils/verifyUser';
import { getCurrentUserId } from '../../utils/getUser';
import { assertCanManage } from '../../lib/members';
import { readSettingsBlob } from '../../lib/appSettingsStore';

jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn().mockResolvedValue('owner') }));
jest.mock('../../lib/members', () => ({ assertCanManage: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/appSettingsStore', () => ({ readSettingsBlob: jest.fn().mockResolvedValue(null), writeSettingsBlob: jest.fn() }));
jest.mock('../../scrapers/index', () => ({ __esModule: true, default: [] }));
jest.mock('next/config', () => () => ({ publicRuntimeConfig: { version: 'test' } }));
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockRejectedValue(new Error('missing')),
  writeFile: jest.fn().mockResolvedValue(undefined),
  rename: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockRejectedValue(new Error('missing')),
}));

type MockResponse = {
  status: jest.Mock<MockResponse, [number]>;
  json: jest.Mock<MockResponse, [unknown]>;
  setHeader: jest.Mock<void, [string, string | number | readonly string[]]>;
};

const makeRes = (): MockResponse => {
  const res = {} as MockResponse;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
};

const makeReq = (method: string): NextApiRequest => ({
  method,
  cookies: {},
  query: {},
  body: {},
  headers: {},
} as unknown as NextApiRequest);

describe('/api/settings authorization', () => {
  const mockVerifyUser = verifyUser as jest.MockedFunction<typeof verifyUser>;
  const mockGetCurrentUserId = getCurrentUserId as jest.MockedFunction<typeof getCurrentUserId>;
  const mockAssertCanManage = assertCanManage as jest.MockedFunction<typeof assertCanManage>;
  const mockReadSettingsBlob = readSettingsBlob as jest.MockedFunction<typeof readSettingsBlob>;

  beforeEach(() => {
    mockVerifyUser.mockResolvedValue('authorized');
    mockGetCurrentUserId.mockResolvedValue('owner');
    mockAssertCanManage.mockResolvedValue(undefined);
    mockReadSettingsBlob.mockClear();
  });

  it('blocks session members before reading decrypted settings', async () => {
    mockGetCurrentUserId.mockResolvedValueOnce('member');
    mockAssertCanManage.mockRejectedValueOnce(new Error('FORBIDDEN'));
    const res = makeRes();

    await settingsHandler(makeReq('GET'), res as unknown as NextApiResponse);

    expect(mockAssertCanManage).toHaveBeenCalledWith('member');
    expect(mockReadSettingsBlob).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin only.' });
  });

  it('allows owner/admin sessions to read settings', async () => {
    const res = makeRes();

    await settingsHandler(makeReq('GET'), res as unknown as NextApiResponse);

    expect(mockAssertCanManage).toHaveBeenCalledWith('owner');
    expect(mockReadSettingsBlob).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
