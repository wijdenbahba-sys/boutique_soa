import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Thème clair / sombre. Choix mémorisé ; par défaut on suit le réglage du système.
const ThemeContext = createContext(null);

function themeInitial() {
  try {
    const sauve = localStorage.getItem('theme');
    if (sauve === 'light' || sauve === 'dark') return sauve;
  } catch { /* stockage bloqué */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(themeInitial);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch { /* ignoré */ }
  }, [theme]);

  const basculer = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const valeur = useMemo(() => ({ theme, basculer }), [theme, basculer]);
  return <ThemeContext.Provider value={valeur}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
