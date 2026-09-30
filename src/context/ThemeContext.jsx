import React, { createContext, useContext, useLayoutEffect, useState } from 'react';

const THEME_KEY = 'softech-erp-theme';
const ThemeContext = createContext(null);

function readSavedTheme() {
  try {
    return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

// Apply the saved choice before React mounts, avoiding a light-theme flash on refresh.
export function initializeTheme() {
  document.documentElement.dataset.theme = readSavedTheme();
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readSavedTheme);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    const browserTheme = document.querySelector('meta[name="theme-color"]');
    browserTheme?.setAttribute('content', theme === 'dark' ? '#111318' : '#f7f9ff');
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Theme still works if local storage is unavailable (private / restricted mode).
    }
  }, [theme]);

  const toggleTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
