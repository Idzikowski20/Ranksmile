/**
 * Safe error-message extraction. `catch (e: any) { e.message }` throws when a non-Error is thrown
 * (string/undefined/rejected value), masking the original failure. Use `catch (e) { getErrorMessage(e) }`.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return String(err);
}
