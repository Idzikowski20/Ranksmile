import { buildServiceStatus, levelCss } from '../../lib/serviceStatus';

describe('buildServiceStatus', () => {
  it('all green when health + ready OK', () => {
    const v = buildServiceStatus(true, { neon: true, redis: true, sidecar: true });
    expect(v.overall).toBe('ok');
    expect(v.services.every((s) => s.level === 'ok')).toBe(true);
    expect(v.services.map((s) => s.name)).toEqual([
      'Web app', 'Data platform', 'Background jobs', 'AI analysis',
    ]);
  });

  it('orange overall when only background/AI fail', () => {
    const v = buildServiceStatus(true, { neon: true, redis: false, sidecar: true });
    expect(v.overall).toBe('degraded');
    expect(v.services.find((s) => s.id === 'jobs')?.level).toBe('degraded');
    expect(levelCss(v.overall)).toBe('yellow');
  });

  it('red overall when app or data is down', () => {
    expect(buildServiceStatus(false, { neon: true, redis: true, sidecar: true }).overall).toBe('down');
    expect(buildServiceStatus(true, { neon: false, redis: true, sidecar: true }).overall).toBe('down');
    expect(levelCss('down')).toBe('red');
  });

  it('skips null optional deps', () => {
    const v = buildServiceStatus(true, { neon: true, redis: null, sidecar: null });
    expect(v.services.map((s) => s.id)).toEqual(['app', 'data']);
    expect(v.overall).toBe('ok');
  });
});
