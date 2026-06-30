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
});
