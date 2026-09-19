/** @jest-environment node */
jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn().mockResolvedValue([[], []]), sync: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('@/src/infrastructure/mcp/oauthStore', () => ({
  ...jest.requireActual('@/src/infrastructure/mcp/oauthStore'),
  verifyAccessToken: jest.fn(),
}));
jest.mock('@/src/infrastructure/billing/requireOrgPaymentAccess', () => ({
  checkUserPaymentAccess: jest.fn().mockResolvedValue({ allowed: true }),
}));
jest.mock('@/src/infrastructure/mcp/tools', () => {
  const actual = jest.requireActual('@/src/infrastructure/mcp/tools');
  const stub = (name: string, handler: () => Promise<unknown>) => ({
    name,
    title: name,
    description: 'test',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler,
  });
  const tools = [
    stub('ok__tool', () => Promise.resolve({ hello: 'world' })),
    stub('denied__tool', () => Promise.reject(new actual.McpToolError('article 7 not found or not accessible'))),
  ];
  return { ...actual, MCP_TOOLS: tools, findTool: (n: string) => tools.find((t) => t.name === n) };
});

import { handleRpc, LATEST_PROTOCOL_VERSION } from '@/src/infrastructure/mcp/rpc';
import { verifyPkce, verifyAccessToken } from '@/src/infrastructure/mcp/oauthStore';
import { checkUserPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import { isAllowedRedirectUri } from '../../pages/api/mcp/oauth/register';
import mcpHandler from '../../pages/api/mcp/index';
import prmHandler from '../../pages/api/mcp/oauth/protected-resource';
import asHandler from '../../pages/api/mcp/oauth/authorization-server';

type FakeRes = {
  statusCode?: number;
  body?: unknown;
  headers: Record<string, string>;
  status: jest.Mock;
  json: jest.Mock;
  end: jest.Mock;
  setHeader: jest.Mock;
};

const makeRes = (): FakeRes => {
  const res = { headers: {} } as FakeRes;
  res.status = jest.fn((code: number) => { res.statusCode = code; return res; });
  res.json = jest.fn((body: unknown) => { res.body = body; return res; });
  res.end = jest.fn(() => res);
  res.setHeader = jest.fn((k: string, v: string) => { res.headers[k] = v; });
  return res;
};

const REQ_HOST = { host: 'ranksmile.test' };

describe('PKCE (RFC 7636 S256)', () => {
  // Vector from RFC 7636 appendix B.
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

  it('accepts the matching verifier', () => expect(verifyPkce(verifier, challenge)).toBe(true));
  it('rejects a wrong verifier', () => expect(verifyPkce(`${verifier}x`, challenge)).toBe(false));
  it('rejects empty input', () => expect(verifyPkce('', challenge)).toBe(false));
});

describe('redirect_uri validation', () => {
  it('allows https, loopback http and app schemes', () => {
    expect(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(true);
    expect(isAllowedRedirectUri('http://localhost:6274/callback')).toBe(true);
    expect(isAllowedRedirectUri('cursor://anysphere.cursor-retrieval/oauth/callback')).toBe(true);
  });
  it('rejects non-loopback http and script/data schemes', () => {
    expect(isAllowedRedirectUri('http://evil.example.com/cb')).toBe(false);
    expect(isAllowedRedirectUri('javascript:alert(1)')).toBe(false);
    expect(isAllowedRedirectUri('data:text/html,x')).toBe(false);
    expect(isAllowedRedirectUri('not a url')).toBe(false);
  });
});

describe('discovery documents', () => {
  it('protected-resource metadata names /mcp as the resource', () => {
    const res = makeRes();
    prmHandler({ method: 'GET', headers: REQ_HOST } as never, res as never);
    expect(res.statusCode).toBe(200);
    const body = res.body as { resource: string; authorization_servers: string[]; scopes_supported: string[] };
    expect(body.resource.endsWith('/mcp')).toBe(true);
    expect(body.authorization_servers).toHaveLength(1);
    expect(body.scopes_supported).toEqual(['mcp:tools']);
  });

  it('authorization-server metadata requires PKCE S256 and offers refresh tokens', () => {
    const res = makeRes();
    asHandler({ method: 'GET', headers: REQ_HOST } as never, res as never);
    const body = res.body as Record<string, unknown>;
    expect(body.code_challenge_methods_supported).toEqual(['S256']);
    expect(body.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
    expect(body.token_endpoint_auth_methods_supported).toEqual(['none']);
    expect(body.authorization_response_iss_parameter_supported).toBe(true);
    expect(String(body.registration_endpoint).endsWith('/reg')).toBe(true);
    expect(String(body.revocation_endpoint).endsWith('/token/revocation')).toBe(true);
  });
});

describe('JSON-RPC dispatch', () => {
  it('initialize echoes a supported version and falls back to the latest otherwise', async () => {
    const r = await handleRpc('u1', { id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } });
    expect(r?.result).toMatchObject({ protocolVersion: '2024-11-05', capabilities: { tools: {} } });

    const r2 = await handleRpc('u1', { id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
    expect((r2?.result as { protocolVersion: string }).protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
  });

  it('answers nothing to a notification', async () => {
    expect(await handleRpc('u1', { method: 'notifications/initialized' })).toBeNull();
  });

  it('lists tools with input and output schemas plus read-only annotations', async () => {
    const r = await handleRpc('u1', { id: 3, method: 'tools/list' });
    const tools = (r?.result as {
      tools: Array<{ name: string; title: string; inputSchema: unknown; outputSchema: unknown; annotations: { readOnlyHint: boolean } }>;
    }).tools;
    expect(tools.map((t) => t.name)).toContain('ok__tool');
    expect(tools[0].inputSchema).toBeDefined();
    expect(tools[0].outputSchema).toBeDefined();
    expect(tools[0].annotations.readOnlyHint).toBe(true);
  });

  it('returns a tool result as text plus structured content', async () => {
    const r = await handleRpc('u1', { id: 4, method: 'tools/call', params: { name: 'ok__tool', arguments: {} } });
    expect(r?.result).toMatchObject({ structuredContent: { hello: 'world' } });
  });

  it('reports an access failure as an isError result, not a protocol error', async () => {
    const r = await handleRpc('u1', { id: 5, method: 'tools/call', params: { name: 'denied__tool' } });
    expect(r?.error).toBeUndefined();
    expect((r?.result as { isError: boolean }).isError).toBe(true);
    expect((r?.result as { structuredContent?: unknown }).structuredContent).toBeUndefined();
  });

  it('rejects an unknown tool and an unknown method', async () => {
    const bad = await handleRpc('u1', { id: 6, method: 'tools/call', params: { name: 'nope' } });
    expect(bad?.error?.code).toBe(-32602);
    const gone = await handleRpc('u1', { id: 7, method: 'does/not/exist' });
    expect(gone?.error?.code).toBe(-32601);
  });
});

describe('/mcp transport', () => {
  const mockVerify = verifyAccessToken as jest.Mock;
  const mockAccess = checkUserPaymentAccess as jest.Mock;
  beforeEach(() => {
    mockVerify.mockReset();
    mockAccess.mockReset().mockResolvedValue({ allowed: true });
  });

  const call = async (over: Record<string, unknown>) => {
    const res = makeRes();
    await mcpHandler({ headers: REQ_HOST, ...over } as never, res as never);
    return res;
  };

  it('challenges an unauthenticated call the way the spec prescribes', async () => {
    const res = await call({ method: 'POST', body: {} });
    expect(res.statusCode).toBe(401);
    expect(res.headers['WWW-Authenticate']).toMatch(/^Bearer error="invalid_token"/);
    expect(res.headers['WWW-Authenticate']).toContain('/.well-known/oauth-protected-resource/mcp');
  });

  it('challenges every verb, not just POST', async () => {
    for (const method of ['GET', 'DELETE']) {
      const res = await call({ method, headers: REQ_HOST });
      expect(res.statusCode).toBe(401);
      expect(res.headers['WWW-Authenticate']).toBeDefined();
    }
  });

  it('rejects a token minted for another resource', async () => {
    mockVerify.mockResolvedValue({ userId: 'u', clientId: 'c', scope: 'mcp:tools', resource: 'https://elsewhere.example/mcp' });
    const res = await call({ method: 'POST', headers: { ...REQ_HOST, authorization: 'Bearer t' }, body: {} });
    expect(res.statusCode).toBe(401);
    expect(res.headers['WWW-Authenticate']).toContain('audience');
  });

  it('rejects an MCP-Protocol-Version it cannot speak', async () => {
    mockVerify.mockResolvedValue({ userId: 'u', clientId: 'c', scope: 'mcp:tools', resource: null });
    const res = await call({
      method: 'POST',
      headers: { ...REQ_HOST, authorization: 'Bearer t', 'mcp-protocol-version': '1999-01-01' },
      body: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toBe('unsupported_protocol_version');
  });

  it('answers GET with 405 and DELETE with 204 once authenticated', async () => {
    mockVerify.mockResolvedValue({ userId: 'u', clientId: 'c', scope: 'mcp:tools', resource: null });
    const get = await call({ method: 'GET', headers: { ...REQ_HOST, authorization: 'Bearer t' } });
    expect(get.statusCode).toBe(405);
    const del = await call({ method: 'DELETE', headers: { ...REQ_HOST, authorization: 'Bearer t' } });
    expect(del.statusCode).toBe(204);
  });

  it('serves tools/list to an authenticated caller', async () => {
    mockVerify.mockResolvedValue({ userId: 'user-42', clientId: 'c', scope: 'mcp:tools', resource: null });
    const res = await call({
      method: 'POST',
      headers: { ...REQ_HOST, authorization: 'Bearer t', 'mcp-protocol-version': '2025-06-18' },
      body: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });
    expect(res.statusCode).toBe(200);
    expect((res.body as { result: { tools: unknown[] } }).result.tools.length).toBeGreaterThan(0);
  });

  it('answers a notification-only batch with 202 and no body', async () => {
    mockVerify.mockResolvedValue({ userId: 'u', clientId: 'c', scope: 'mcp:tools', resource: null });
    const res = await call({
      method: 'POST',
      headers: { ...REQ_HOST, authorization: 'Bearer t' },
      body: [{ jsonrpc: '2.0', method: 'notifications/initialized' }],
    });
    expect(res.statusCode).toBe(202);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('rejects an empty batch as an invalid request, not as an empty notification set', async () => {
    mockVerify.mockResolvedValue({ userId: 'u', clientId: 'c', scope: 'mcp:tools', resource: null });
    const res = await call({
      method: 'POST',
      headers: { ...REQ_HOST, authorization: 'Bearer t' },
      body: [],
    });
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: number } }).error.code).toBe(-32600);
  });

  it('rejects a message missing jsonrpc before it can reach a tool', async () => {
    mockVerify.mockResolvedValue({ userId: 'u', clientId: 'c', scope: 'mcp:tools', resource: null });
    const res = await call({
      method: 'POST',
      headers: { ...REQ_HOST, authorization: 'Bearer t' },
      body: { id: 1, method: 'tools/call', params: { name: 'ok__tool' } },
    });
    expect(res.statusCode).toBe(400);
    const body = res.body as { id: number; error: { code: number } };
    expect(body.error.code).toBe(-32600);
    expect(body.id).toBe(1);
  });

  it('answers a primitive batch element with -32600 rather than method-not-found', async () => {
    mockVerify.mockResolvedValue({ userId: 'u', clientId: 'c', scope: 'mcp:tools', resource: null });
    const res = await call({
      method: 'POST',
      headers: { ...REQ_HOST, authorization: 'Bearer t' },
      body: ['nonsense', { jsonrpc: '2.0', id: 2, method: 'ping' }],
    });
    expect(res.statusCode).toBe(200);
    const body = res.body as { id: unknown; error?: { code: number } }[];
    expect(body[0].error?.code).toBe(-32600);
    expect(body[0].id).toBeNull();
    expect(body[1].error).toBeUndefined();
  });

  it('refuses a caller whose organization is payment-blocked', async () => {
    // Bearer requests carry no session, so the endpoint takes the access decision on
    // the token's user rather than through withOrgPaymentAccess.
    mockVerify.mockResolvedValue({ userId: 'u', clientId: 'c', scope: 'mcp:tools', resource: null });
    mockAccess.mockResolvedValue({ allowed: false, status: 402, body: { code: 'BILLING_REQUIRED' } });
    const res = await call({
      method: 'POST',
      headers: { ...REQ_HOST, authorization: 'Bearer t' },
      body: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });
    expect(res.statusCode).toBe(402);
    expect(mockAccess).toHaveBeenCalledWith('u', 'POST:/api/mcp');
  });

  it('refuses a token that does not carry the tools scope', async () => {
    mockVerify.mockResolvedValue({ userId: 'u', clientId: 'c', scope: 'openid', resource: null });
    const res = await call({
      method: 'POST',
      headers: { ...REQ_HOST, authorization: 'Bearer t' },
      body: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.headers['WWW-Authenticate']).toContain('insufficient_scope');
  });
});
