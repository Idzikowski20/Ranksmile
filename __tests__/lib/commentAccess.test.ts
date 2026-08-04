jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn() }));
jest.mock('../../lib/tenancy', () => ({
  assertArticleAccess: jest.fn(),
}));

import { getCurrentUserId } from '../../utils/getUser';
import { assertArticleAccess } from '../../lib/tenancy';
import { assertCommentAccess } from '../../lib/commentAccess';

const mockUser = getCurrentUserId as jest.Mock;
const mockOwner = assertArticleAccess as jest.Mock;
const res = {} as Parameters<typeof assertCommentAccess>[1];

beforeEach(() => { mockUser.mockReset(); mockOwner.mockReset(); });

it('allows the authenticated owner', async () => {
  mockUser.mockResolvedValueOnce('owner-1');
  mockOwner.mockResolvedValueOnce(true);
  const req = { query: {} } as Parameters<typeof assertCommentAccess>[0];
  expect(await assertCommentAccess(req, res, 123)).toBe(true);
});

it('denies an authenticated caller who cannot reach the article', async () => {
  mockUser.mockResolvedValueOnce('intruder');
  mockOwner.mockResolvedValueOnce(false);
  const req = { query: {} } as Parameters<typeof assertCommentAccess>[0];
  expect(await assertCommentAccess(req, res, 123)).toBe(false);
});

it('denies when there is no session', async () => {
  mockUser.mockResolvedValueOnce(null);
  const req = { query: {} } as Parameters<typeof assertCommentAccess>[0];
  expect(await assertCommentAccess(req, res, 123)).toBe(false);
});

it('denies a non-integer article id without querying', async () => {
  const req = { query: {} } as Parameters<typeof assertCommentAccess>[0];
  expect(await assertCommentAccess(req, res, NaN)).toBe(false);
  expect(mockUser).not.toHaveBeenCalled();
});
