import { createContext, useContext } from 'react';
import type { ButtonProps } from '../../components/core/button/types';

const TrackingContext = createContext<() => (_props: ButtonProps) => void>(() => () => {});

export const TrackingContextProvider = TrackingContext.Provider;

export function useButtonTracking() {
  return useContext(TrackingContext)();
}
