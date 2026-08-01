/**
 * Log deprecated install-wide APIKEY usage.
 * Does not throw — never block auth on metrics failure.
 */
export async function logLegacyApiKeyUse(opts: {
  endpoint: string;
  ip: string | undefined;
}): Promise<void> {
  console.warn(
    JSON.stringify({
      msg: 'Legacy APIKEY used',
      endpoint: opts.endpoint,
      ip: opts.ip || 'unknown',
      timestamp: new Date().toISOString(),
    }),
  );
}
