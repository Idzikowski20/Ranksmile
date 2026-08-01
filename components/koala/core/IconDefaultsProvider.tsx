import { createContext, useContext } from 'react';
import type { SVGIconProps } from './svgIcon';

const IconDefaultsContext = createContext<SVGIconProps>({});

export function IconDefaultsProvider({ children, ...props }: SVGIconProps & { children: React.ReactNode }) {
  return <IconDefaultsContext.Provider value={props}>{children}</IconDefaultsContext.Provider>;
}

export function useIconDefaults(props: SVGIconProps) {
  return { ...useContext(IconDefaultsContext), ...props };
}
