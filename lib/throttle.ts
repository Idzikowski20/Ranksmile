/**
 * Trailing-edge throttle: fires immediately on the first call, then at most once
 * per `ms` window, always delivering the most recent args at the trailing edge.
 * Used to cap Ably publish rate for content/caret while typing.
 */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: A | null = null;

  const invoke = (args: A) => { last = Date.now(); fn(...args); };

  const throttled = (...args: A) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      if (timer) { clearTimeout(timer); timer = null; }
      invoke(args);
    } else {
      pending = args;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          if (pending) { const p = pending; pending = null; invoke(p); }
        }, remaining);
      }
    }
  };

  throttled.cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    pending = null;
  };

  return throttled;
}
