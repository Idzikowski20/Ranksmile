import { assertCronSecret, cronSecrets } from '../../lib/cronAuth';

describe('cronAuth', () => {
  const OLD = {
    CRON_SECRET: process.env.CRON_SECRET,
    CRON_SECRET_CURRENT: process.env.CRON_SECRET_CURRENT,
    CRON_SECRET_PREVIOUS: process.env.CRON_SECRET_PREVIOUS,
  };

  afterEach(() => {
    for (const [k, v] of Object.entries(OLD)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('fail-closed when no secrets', () => {
    delete process.env.CRON_SECRET;
    delete process.env.CRON_SECRET_CURRENT;
    delete process.env.CRON_SECRET_PREVIOUS;
    expect(cronSecrets()).toEqual([]);
    expect(assertCronSecret({ headers: { authorization: 'Bearer undefined' } } as never)).toBe(false);
  });

  it('accepts CRON_SECRET alias as current', () => {
    delete process.env.CRON_SECRET_CURRENT;
    delete process.env.CRON_SECRET_PREVIOUS;
    process.env.CRON_SECRET = 'sec-a';
    expect(assertCronSecret({ headers: { authorization: 'Bearer sec-a' } } as never)).toBe(true);
    expect(assertCronSecret({ headers: { authorization: 'Bearer wrong' } } as never)).toBe(false);
  });

  it('accepts CURRENT and PREVIOUS during rotation', () => {
    delete process.env.CRON_SECRET;
    process.env.CRON_SECRET_CURRENT = 'new-sec';
    process.env.CRON_SECRET_PREVIOUS = 'old-sec';
    expect(assertCronSecret({ headers: { authorization: 'Bearer new-sec' } } as never)).toBe(true);
    expect(assertCronSecret({ headers: { authorization: 'Bearer old-sec' } } as never)).toBe(true);
  });
});
