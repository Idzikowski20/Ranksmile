jest.mock('../../utils/verifyUser', () => ({ __esModule: true, default: jest.fn().mockResolvedValue('authorized') }));
jest.mock('../../lib/serviceUrls', () => ({ sidecarUrl: jest.fn(() => 'http://sidecar.test') }));
jest.mock('../../lib/ssrfGuard', () => ({ assertPublicUrl: jest.fn().mockResolvedValue(new URL('https://example.com')) }));
jest.mock('axios', () => ({ __esModule: true, default: { post: jest.fn() } }));

import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import handler from '../../pages/api/brand-knowledge';
import { assertPublicUrl } from '../../lib/ssrfGuard';

const mockAxiosPost = axios.post as jest.MockedFunction<typeof axios.post>;
const mockAssertPublicUrl = assertPublicUrl as jest.MockedFunction<typeof assertPublicUrl>;

type TestResponse = NextApiResponse & {
  statusCode?: number;
  body?: unknown;
};

function makeRes(): TestResponse {
  const res: TestResponse = {
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  } as TestResponse;
  return res;
}

function makeReq(url: string): NextApiRequest {
  return {
    method: 'POST',
    body: { url },
    query: {},
    cookies: {},
    headers: {},
  } as unknown as NextApiRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAssertPublicUrl.mockResolvedValue(new URL('https://example.com'));
  mockAxiosPost.mockResolvedValue({ data: { brand_name: 'Example', brand_knowledge: 'About Example' } });
});

describe('POST /api/brand-knowledge SSRF guard', () => {
  it('rejects blocked URLs before proxying to the sidecar', async () => {
    mockAssertPublicUrl.mockRejectedValue(new Error('Blocked private address'));
    const res = makeRes();

    await handler(makeReq('http://169.254.169.254/latest/meta-data/'), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Blocked private address' });
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });
});
