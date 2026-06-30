import { throttle } from '../../lib/throttle';

jest.useFakeTimers();

describe('throttle (trailing edge)', () => {
  it('fires immediately, then coalesces rapid calls into one trailing call', () => {
    const fn = jest.fn();
    const t = throttle(fn, 300);
    t('a'); // leading
    t('b');
    t('c'); // last wins for the trailing call
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith('a');
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c');
  });

  it('cancel() drops a pending trailing call', () => {
    const fn = jest.fn();
    const t = throttle(fn, 300);
    t('a');
    t('b');
    t.cancel();
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1); // only the leading call
  });

  it('fires immediately again after the window elapses (leading edge resets)', () => {
    const fn = jest.fn();
    const t = throttle(fn, 300);
    t('a');                          // leading
    expect(fn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(300);   // window passes, no pending → no trailing
    expect(fn).toHaveBeenCalledTimes(1);
    t('b');                          // must fire immediately as a fresh leading call
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });
});
