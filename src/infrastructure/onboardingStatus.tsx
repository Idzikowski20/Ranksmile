import React from 'react';

/**
 * Lets the onboarding page tell the (always-mounted) OnboardingGuard in _app.tsx
 * that onboarding just finished, so the guard's cached `completed` flag is updated
 * immediately instead of waiting for the next session change / refetch.
 */
type Setter = (completed: boolean) => void;

export const OnboardingStatusContext = React.createContext<Setter>(() => {});

export const useMarkOnboardingComplete = (): Setter => React.useContext(OnboardingStatusContext);
