import React from 'react';

/**
 * Lets confirm-account/confirm-email tell the (always-mounted) OnboardingGuard in _app.tsx
 * that the e-mail was just confirmed, so the guard's cached `confirmed` flag is updated
 * immediately instead of waiting for a userId change / refetch. Without this, a client-side
 * router.replace('/onboarding') right after verification leaves the guard's stale
 * confirmed=false in place, which bounces the user straight back to /auth/confirm-account —
 * see lib/onboardingStatus.tsx for the identical precedent this mirrors.
 */
type Setter = (confirmed: boolean) => void;

export const EmailConfirmedStatusContext = React.createContext<Setter>(() => {});

export const useMarkEmailConfirmed = (): Setter => React.useContext(EmailConfirmedStatusContext);
