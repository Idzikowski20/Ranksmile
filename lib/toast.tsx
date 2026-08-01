/**
 * App toast helpers — wraps react-hot-toast with Koala variants.
 * Use toastPromise for async UX.
 */
import React from 'react';
import toast, { type ToastOptions } from 'react-hot-toast';

export type ShowToastType = 'default' | 'success' | 'error' | 'loading';

export type ShowToastOptions = {
  type?: ShowToastType;
  message: string;
  undo?: () => void;
  duration?: number;
  id?: string;
};

const baseOpts: ToastOptions = {
  className: 'app-toast',
};

export function showToast({ type = 'default', message, undo, duration, id }: ShowToastOptions) {
  const opts: ToastOptions = {
    ...baseOpts,
    duration: duration ?? (type === 'loading' ? Infinity : 4000),
    id,
  };

  if (undo) {
    return toast(
      (t) => (
        <span className="app-toast-row">
          <span>{message}</span>
          <button
            type="button"
            className="app-toast-undo"
            onClick={() => {
              undo();
              toast.dismiss(t.id);
            }}
          >
            Undo
          </button>
        </span>
      ),
      opts,
    );
  }

  if (type === 'success') return toast.success(message, opts);
  if (type === 'error') return toast.error(message, opts);
  if (type === 'loading') return toast.loading(message, opts);
  return toast(message, opts);
}

export function toastPromise<T>(
  promise: Promise<T>,
  messages: { loading: string; success: string; error: string | ((err: unknown) => string) },
): Promise<T> {
  return toast.promise(promise, messages, { className: 'app-toast' });
}

export { toast };
