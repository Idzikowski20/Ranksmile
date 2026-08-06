/**
 * Request/response doubles for Next.js API-route unit tests.
 *
 * Lives outside `__tests__` on purpose: Jest's default `testMatch` treats every file
 * under that directory as a suite and would fail this one for containing no tests.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

export type MockRes = Record<string, jest.Mock>;

/** Chainable `res` double — `status()` and `json()` return the same object, as Next's does. */
export const makeRes = (): MockRes => {
  const res: MockRes = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.end = jest.fn().mockReturnValue(res);
  return res;
};

export type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => unknown;

/**
 * Invokes `handler` with a minimal request. `headers`, `cookies` and `body` default to
 * empty objects so handlers that destructure them don't throw on an unset field.
 */
export const callHandler = (
  handler: ApiHandler,
  req: Partial<NextApiRequest>,
  res: MockRes,
): unknown => handler(
  { headers: {}, cookies: {}, body: {}, ...req } as NextApiRequest,
  res as unknown as NextApiResponse,
);
