/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';

function mockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as NextApiResponse & { statusCode: number; body: unknown };
}

jest.mock('../../lib/db/query', () => ({
  queryOne: jest.fn(),
}));

jest.mock('../../lib/serviceUrls', () => ({
  logResolvedSidecarUrl: jest.fn(),
}));

const mockPing = jest.fn();
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockQuit = jest.fn().mockResolvedValue('OK');
const mockDisconnect = jest.fn();

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    ping: mockPing,
    connect: mockConnect,
    quit: mockQuit,
    disconnect: mockDisconnect,
  })),
}));

import health from '../../pages/api/health';
import ready from '../../pages/api/ready';
import { queryOne } from '../../lib/db/query';

const mockedQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;

describe('/api/health', () => {
  it('returns 200 { ok: true }', async () => {
    const req = { method: 'GET' } as NextApiRequest;
    const res = mockRes();
    await health(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('/api/ready', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
    jest.clearAllMocks();
  });

  it('503 when REDIS_URL missing in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.REDIS_URL;
    delete process.env.RAILWAY_ENVIRONMENT;
    mockedQueryOne.mockResolvedValue({ ok: 1 });
    const res = mockRes();
    await ready({ method: 'GET' } as NextApiRequest, res);
    expect(res.statusCode).toBe(503);
  });

  it('503 on Railway when PYTHON_SIDECAR_URL missing', async () => {
    process.env.RAILWAY_ENVIRONMENT = 'production';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    delete process.env.PYTHON_SIDECAR_URL;
    delete process.env.SIDECAR_URL;
    mockedQueryOne.mockResolvedValue({ ok: 1 });
    mockPing.mockResolvedValue('PONG');
    const res = mockRes();
    await ready({ method: 'GET' } as NextApiRequest, res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ ok: false, sidecar: false });
  });

  it('200 when Neon + Redis + sidecar URL OK', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RAILWAY_ENVIRONMENT = 'production';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.PYTHON_SIDECAR_URL = 'http://sidecar.railway.internal:8001';
    mockedQueryOne.mockResolvedValue({ ok: 1 });
    mockPing.mockResolvedValue('PONG');
    const res = mockRes();
    await ready({ method: 'GET' } as NextApiRequest, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, neon: true, redis: true, sidecar: true });
  });
});
