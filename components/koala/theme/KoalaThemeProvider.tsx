import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeProvider as EmotionThemeProvider } from '@emotion/react';
import { theme as baseTheme } from '../tokens/theme';
import {
  THEME_NAMES,
  lightTheme,
  themes,
  themeToCssVars,
  type ThemeName,
  type ThemeSemantic,
} from '../tokens/themes';

const STORAGE_KEY = 'ranksmile-theme';

type ThemeContextValue = {
  themeName: ThemeName;
  semantic: ThemeSemantic;
  setTheme: (name: ThemeName) => void;
  cycleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeName(v: string): v is ThemeName {
  return (THEME_NAMES as string[]).includes(v);
}

function readStored(): ThemeName {
  if (typeof window === 'undefined') return 'light';
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && isThemeName(v)) return v;
  } catch {
    /* ignore */
  }
  return 'light';
}

function applyDomTheme(name: ThemeName, semantic: ThemeSemantic) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', name);
  Object.entries(themeToCssVars(semantic)).forEach(([k, val]) => {
    root.style.setProperty(k, val);
  });
}

export function KoalaThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>('light');

  useEffect(() => {
    const name = readStored();
    setThemeName(name);
    applyDomTheme(name, themes[name]);
  }, []);

  const setTheme = useCallback((name: ThemeName) => {
    setThemeName(name);
    applyDomTheme(name, themes[name]);
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {
      /* ignore */
    }
  }, []);

  const cycleTheme = useCallback(() => {
    const i = THEME_NAMES.indexOf(themeName);
    setTheme(THEME_NAMES[(i + 1) % THEME_NAMES.length]);
  }, [themeName, setTheme]);

  const semantic = themes[themeName] ?? lightTheme;

  const emotionTheme = useMemo(
    () => ({
      ...baseTheme,
      type: themeName,
      semantic,
    }),
    [themeName, semantic],
  );

  const value = useMemo(
    () => ({ themeName, semantic, setTheme, cycleTheme }),
    [themeName, semantic, setTheme, cycleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <EmotionThemeProvider theme={emotionTheme}>{children}</EmotionThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useKoalaTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      themeName: 'light',
      semantic: lightTheme,
      setTheme: () => undefined,
      cycleTheme: () => undefined,
    };
  }
  return ctx;
}

export default KoalaThemeProvider;
