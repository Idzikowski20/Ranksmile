/** Shared adapter error — UI maps NOT_IMPLEMENTED → "coming soon" toast. */
export type AdapterErrorCode = 'NOT_IMPLEMENTED' | 'NETWORK' | 'UNAUTHORIZED' | 'VALIDATION' | 'UNKNOWN';

export class AdapterError extends Error {
  readonly code: AdapterErrorCode;
  readonly details?: unknown;

  constructor(code: AdapterErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AdapterError';
    this.code = code;
    this.details = details;
  }
}

export function isAdapterError(err: unknown): err is AdapterError {
  return err instanceof AdapterError;
}

export function notImplemented(feature: string): never {
  throw new AdapterError('NOT_IMPLEMENTED', `${feature} is not available yet`);
}
