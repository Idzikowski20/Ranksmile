import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeProvider as EmotionThemeProvider } from '@emotion/react';
import { theme as baseTheme } from '../tokens/theme';
import {
  ACCENT_NAMES,
  THEME_NAMES,
  applyAccent,
  lightTheme,
  themes,
  themeToCssVars,
  type AccentName,
  type ThemeName,
  type ThemeSemantic,
} from '../tokens/themes';

const STORAGE_KEY = 'ranksmile-theme';
const ACCENT_STORAGE_KEY = 'ranksmile-accent';

type ThemeContextValue = {
  themeName: ThemeName;
  accentName: AccentName;
  semantic: ThemeSemantic;
  setTheme: (name: ThemeName) => void;
  setAccent: (name: AccentName) => void;
  cycleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeName(v: string): v is ThemeName {
  return (THEME_NAMES as string[]).includes(v);
}

function isAccentName(v: string): v is AccentName {
  return (ACCENT_NAMES as string[]).includes(v);
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

function readStoredAccent(): AccentName {
  if (typeof window === 'undefined') return 'default';
  try {
    const v = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (v && isAccentName(v)) return v;
  } catch {
    /* ignore */
  }
  return 'default';
}

function buildSemantic(name: ThemeName, accent: AccentName): ThemeSemantic {
  return applyAccent(themes[name] ?? lightTheme, accent, name);
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
  const [accentName, setAccentName] = useState<AccentName>('default');

  useEffect(() => {
    const name = readStored();
    const accent = readStoredAccent();
    setThemeName(name);
    setAccentName(accent);
    applyDomTheme(name, buildSemantic(name, accent));
  }, []);

  const setTheme = useCallback(
    (name: ThemeName) => {
      setThemeName(name);
      applyDomTheme(name, buildSemantic(name, accentName));
      try {
        localStorage.setItem(STORAGE_KEY, name);
      } catch {
        /* ignore */
      }
    },
    [accentName],
  );

  const setAccent = useCallback(
    (accent: AccentName) => {
      setAccentName(accent);
      applyDomTheme(themeName, buildSemantic(themeName, accent));
      try {
        localStorage.setItem(ACCENT_STORAGE_KEY, accent);
      } catch {
        /* ignore */
      }
    },
    [themeName],
  );

  const cycleTheme = useCallback(() => {
    const i = THEME_NAMES.indexOf(themeName);
    setTheme(THEME_NAMES[(i + 1) % THEME_NAMES.length]);
  }, [themeName, setTheme]);

  // Memoised because this provider wraps the whole app. For a non-default accent
  // buildSemantic → applyAccent spreads a fresh object every call, so an unmemoised
  // `semantic` gave `emotionTheme` and `value` a new identity on every parent render and
  // re-rendered the tree with them.
  const semantic = useMemo(() => buildSemantic(themeName, accentName), [themeName, accentName]);

  const emotionTheme = useMemo(
    () => ({
      ...baseTheme,
      type: themeName,
      semantic,
    }),
    [themeName, semantic],
  );

  const value = useMemo(
    () => ({ themeName, accentName, semantic, setTheme, setAccent, cycleTheme }),
    [themeName, accentName, semantic, setTheme, setAccent, cycleTheme],
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
      accentName: 'default',
      semantic: lightTheme,
      setTheme: () => undefined,
      setAccent: () => undefined,
      cycleTheme: () => undefined,
    };
  }
  return ctx;
}

export default KoalaThemeProvider;
