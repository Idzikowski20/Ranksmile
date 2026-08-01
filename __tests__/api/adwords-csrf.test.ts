/**
 * AdWords callback rejects CSRF (bad/missing state) without writing settings.json.
 */
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));
jest.mock('../../utils/getUser', () => ({
  getCurrentUserId: jest.fn().mockResolvedValue('user-1'),
}));
jest.mock('../../utils/adwords', () => ({
  getAdwordsCredentials: jest.fn(),
  getAdwordsKeywordIdeas: jest.fn(),
}));
jest.mock('../../utils/verifyUser', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue('authorized'),
}));
jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { sync: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../../lib/requireOrgPaymentAccess', () => ({
  withOrgPaymentAccess: (h: unknown) => h,
}));
jest.mock('next/config', () => () => ({ serverRuntimeConfig: {} }));
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    getToken: jest.fn(),
  })),
}));
jest.mock('cryptr', () => jest.fn().mockImplementation(() => ({
  encrypt: (s: string) => s,
  decrypt: (s: string) => s,
})));

import { writeFile } from 'fs/promises';
import handler from '../../pages/api/adwords';

const mockWrite = writeFile as jest.MockedFunction<typeof writeFile>;

const makeRes = () => {
  const res: {
    status: jest.Mock;
    send: jest.Mock;
    json: jest.Mock;
    setHeader: jest.Mock;
  } = {
    status: jest.fn(),
    send: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.send.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

it('rejects callback with mismatched oauth state and does not write settings', async () => {
  const res = makeRes();
  await handler(
    {
      method: 'GET',
      query: {
        code: 'fake-code',
        state: JSON.stringify({ userId: 'user-1', nonce: 'abc' }),
      },
      cookies: { adwords_oauth_state: 'other' },
      headers: {},
    } as never,
    res as never,
  );
  expect(res.status).toHaveBeenCalledWith(400);
  expect(mockWrite).not.toHaveBeenCalled();
});
