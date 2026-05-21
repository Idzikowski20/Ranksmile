/* eslint-disable import/no-unresolved, import/prefer-default-export */
/**
 * Singleton Neon Auth client for browser-side usage.
 * Points to /api/auth by default (our Pages Router proxy).
 */
// @ts-ignore — subpath exports require moduleResolution bundler; declared in types.d.ts
import { createAuthClient } from '@neondatabase/auth/next';

export const authClient = createAuthClient();
