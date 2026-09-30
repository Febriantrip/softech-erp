import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeSwitch() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={`theme-switch${isDark ? ' theme-switch--dark' : ''}`}
      aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
      aria-pressed={isDark}
      title={isDark ? 'Mode gelap aktif · klik untuk mode terang' : 'Mode terang aktif · klik untuk mode gelap'}
      onClick={toggleTheme}
    >
      <span className="theme-switch__thumb" aria-hidden="true" />
      <span className="theme-switch__icon theme-switch__icon--sun" aria-hidden="true"><Sun size={17} strokeWidth={2.1} /></span>
      <span className="theme-switch__icon theme-switch__icon--moon" aria-hidden="true"><Moon size={17} strokeWidth={2.1} fill="currentColor" /></span>
    </button>
  );
}
