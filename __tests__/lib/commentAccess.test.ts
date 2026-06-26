jest.mock('../../utils/getUser', () => ({ getCurrentUserId: jest.fn() }));
jest.mock('../../lib/tenancy', () => ({
  articleIdForShareToken: jest.fn(),
  assertArticleAccess: jest.fn(),
}));

import { getCurrentUserId } from '../../utils/getUser';
import { articleIdForShareToken, assertArticleAccess } from '../../lib/tenancy';
import { assertCommentAccess } from '../../lib/commentAccess';

const mockUser = getCurrentUserId as jest.Mock;
const mockToken = articleIdForShareToken as jest.Mock;
const mockOwner = assertArticleAccess as jest.Mock;
const res = {} as any;

beforeEach(() => { mockUser.mockReset(); mockToken.mockReset(); mockOwner.mockReset(); });

it('allows a share token that resolves to the requested article (no user lookup)', async () => {
  mockToken.mockResolvedValueOnce(123);
  const req = { query: { token: 'tok_ok' } } as any;
  expect(await assertCommentAccess(req, res, 123)).toBe(true);
  expect(mockUser).not.toHaveBeenCalled();
});

it('denies a token that resolves to a different article when there is no session', async () => {
  mockToken.mockResolvedValueOnce(999);
  mockUser.mockResolvedValueOnce(null);
  const req = { query: { token: 'tok_other' } } as any;
  expect(await assertCommentAccess(req, res, 123)).toBe(false);
});

it('allows the authenticated owner when no token is present', async () => {
  mockUser.mockResolvedValueOnce('owner-1');
  mockOwner.mockResolvedValueOnce(true);
  const req = { query: {} } as any;
  expect(await assertCommentAccess(req, res, 123)).toBe(true);
  expect(mockToken).not.toHaveBeenCalled();
});

it('denies an authenticated caller who cannot reach the article', async () => {
  mockUser.mockResolvedValueOnce('intruder');
  mockOwner.mockResolvedValueOnce(false);
  const req = { query: {} } as any;
  expect(await assertCommentAccess(req, res, 123)).toBe(false);
});

it('denies a non-integer article id without querying', async () => {
  const req = { query: { token: 'tok_ok' } } as any;
  expect(await assertCommentAccess(req, res, NaN)).toBe(false);
  expect(mockToken).not.toHaveBeenCalled();
  expect(mockUser).not.toHaveBeenCalled();
});
