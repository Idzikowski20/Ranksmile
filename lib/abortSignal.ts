/** Throw standard AbortError when a cooperative cancel was requested. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
    || (err instanceof Error && err.name === 'AbortError');
}
