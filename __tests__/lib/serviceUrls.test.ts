/** @jest-environment node */

describe('sidecarUrl', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
    jest.resetModules();
  });

  it('uses PYTHON_SIDECAR_URL when set', async () => {
    process.env.PYTHON_SIDECAR_URL = 'http://python-sidecar.railway.internal:8001';
    process.env.NODE_ENV = 'production';
    delete process.env.RAILWAY_ENVIRONMENT;
    const { sidecarUrl } = await import('../../lib/serviceUrls');
    expect(sidecarUrl()).toBe('http://python-sidecar.railway.internal:8001');
  });

  it('throws on Railway when PYTHON_SIDECAR_URL missing', async () => {
    process.env.RAILWAY_ENVIRONMENT = 'production';
    process.env.NODE_ENV = 'production';
    delete process.env.PYTHON_SIDECAR_URL;
    delete process.env.SIDECAR_URL;
    const { sidecarUrl } = await import('../../lib/serviceUrls');
    expect(() => sidecarUrl()).toThrow(/PYTHON_SIDECAR_URL/);
  });

  it('does not return onrender.com on Railway', async () => {
    process.env.RAILWAY_ENVIRONMENT = 'production';
    process.env.PYTHON_SIDECAR_URL = 'http://sidecar.railway.internal:8001';
    const { sidecarUrl } = await import('../../lib/serviceUrls');
    expect(sidecarUrl()).not.toMatch(/onrender\.com/);
  });

  it('refuses Render URL on Railway', async () => {
    process.env.RAILWAY_ENVIRONMENT = 'production';
    process.env.PYTHON_SIDECAR_URL = 'https://ranksmile-sidecar.onrender.com';
    const { sidecarUrl } = await import('../../lib/serviceUrls');
    expect(() => sidecarUrl()).toThrow(/Render/);
  });
});
