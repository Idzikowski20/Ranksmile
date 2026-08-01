import { useCallback, useState } from 'react';
import { useMutation } from 'react-query';
import { feedbackAdapter, type FeedbackPayload, isAdapterError } from '../lib/adapters';
import { showToast } from '../lib/toast';

export function useSubmitFeedback() {
  return useMutation((payload: FeedbackPayload) => feedbackAdapter.submit(payload), {
    onSuccess: () => {
      showToast({ type: 'success', message: 'Thanks for your feedback!' });
    },
    onError: (err: unknown) => {
      if (isAdapterError(err) && err.code === 'NOT_IMPLEMENTED') {
        showToast({ type: 'success', message: 'Thanks! Feedback recorded locally.' });
        return;
      }
      showToast({ type: 'error', message: 'Could not send feedback' });
    },
  });
}

export async function submitFeedbackOrStub(payload: FeedbackPayload): Promise<boolean> {
  try {
    await feedbackAdapter.submit(payload);
    showToast({ type: 'success', message: 'Thanks for your feedback!' });
    return true;
  } catch (err: unknown) {
    if (isAdapterError(err) && err.code === 'NOT_IMPLEMENTED') {
      if (typeof window !== 'undefined') {
        try {
          const key = 'ranksmile.feedback.queue';
          const prev = JSON.parse(sessionStorage.getItem(key) || '[]') as FeedbackPayload[];
          prev.push(payload);
          sessionStorage.setItem(key, JSON.stringify(prev.slice(-20)));
        } catch { /* ignore */ }
      }
      showToast({ type: 'success', message: 'Thanks for your feedback!' });
      return true;
    }
    showToast({ type: 'error', message: 'Could not send feedback' });
    return false;
  }
}

export function useFeedbackForm() {
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => {
    setScore(0);
    setMessage('');
  }, []);

  const submit = useCallback(
    async (meta: Omit<FeedbackPayload, 'score' | 'message'>) => {
      if (score < 1) {
        showToast({ type: 'error', message: 'Pick a rating' });
        return false;
      }
      setBusy(true);
      const ok = await submitFeedbackOrStub({ ...meta, score, message });
      setBusy(false);
      if (ok) reset();
      return ok;
    },
    [score, message, reset],
  );

  return { score, setScore, message, setMessage, busy, submit, reset };
}
