import { notImplemented } from './types';

export type MfaEnrollResult = {
  qrDataUrl: string;
  secret: string;
};

export type MfaVerifyInput = { code: string };

/** MFA enroll — no backend in repo yet (only login verify). */
export async function enrollMfa(): Promise<MfaEnrollResult> {
  notImplemented('MFA enroll');
}

export async function confirmMfa(_input: MfaVerifyInput): Promise<{ ok: true }> {
  notImplemented('MFA confirm');
}

export const mfaAdapter = { enroll: enrollMfa, confirm: confirmMfa };
