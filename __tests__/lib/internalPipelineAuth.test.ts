/** @jest-environment node */
/**
 * The sidecar's credential check. Guards the shape of the comparison, not the timing:
 * a wrong token must be rejected, and an unset secret must never authorize anything.
 */
import type { NextApiRequest } from 'next';
import { isInternalPipelineRequest } from '@/src/infrastructure/aiVisibility/internalPipelineAuth';

const req = (token?: string | string[]): NextApiRequest => (
   { headers: token === undefined ? {} : { 'x-internal-token': token } } as unknown as NextApiRequest
);

describe('isInternalPipelineRequest', () => {
   const saved = process.env.INTERNAL_PIPELINE_TOKEN;
   afterEach(() => { process.env.INTERNAL_PIPELINE_TOKEN = saved; });

   it('accepts the configured token', () => {
      process.env.INTERNAL_PIPELINE_TOKEN = 'sekret';
      expect(isInternalPipelineRequest(req('sekret'))).toBe(true);
   });

   it('rejects a wrong token, including a matching prefix', () => {
      process.env.INTERNAL_PIPELINE_TOKEN = 'sekret';
      expect(isInternalPipelineRequest(req('sekre'))).toBe(false);
      expect(isInternalPipelineRequest(req('sekretx'))).toBe(false);
      expect(isInternalPipelineRequest(req(''))).toBe(false);
      expect(isInternalPipelineRequest(req())).toBe(false);
   });

   it('rejects a repeated header, which arrives as an array', () => {
      process.env.INTERNAL_PIPELINE_TOKEN = 'sekret';
      expect(isInternalPipelineRequest(req(['sekret', 'sekret']))).toBe(false);
   });

   it('authorizes nothing when the secret is unset', () => {
      delete process.env.INTERNAL_PIPELINE_TOKEN;
      expect(isInternalPipelineRequest(req('anything'))).toBe(false);
      expect(isInternalPipelineRequest(req(''))).toBe(false);
   });
});
