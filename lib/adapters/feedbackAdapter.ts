import { notImplemented } from './types';

export type FeedbackPayload = {
  score: number;
  message: string;
  context: string;
  route: string;
  component: string;
  userAgent: string;
};

export type FeedbackResult = { ok: true };

/** Feedback persistence — stub until endpoint exists. */
export async function submitFeedback(_payload: FeedbackPayload): Promise<FeedbackResult> {
  notImplemented('Feedback');
}

export const feedbackAdapter = { submit: submitFeedback };
