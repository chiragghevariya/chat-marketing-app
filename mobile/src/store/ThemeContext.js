import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@marketplace/themeMode';

// Premium Light Theme Palette (warm off-white backgrounds, dark grey text)
const lightColors = {
  accent: '#E65100',
  accentDark: '#AC1900',
  accentLight: '#FF833A',
  accentSoft: '#FFF3E0',

  background: '#FAF9F6', // elegant alabaster instead of stark white
  surface: '#FFFFFF',
  card: '#FFFFFF',
  border: '#EBEAE6',
  divider: '#F4F3EF',

  text: '#1C1B19',
  textMuted: '#706E6B',
  textInverse: '#FFFFFF',

  success: '#2E7D32',
  danger: '#D32F2F',
  warning: '#ED6C02',

  muted: '#9E9D9A',
  skeleton: '#EFEFE9',
  overlay: 'rgba(0, 0, 0, 0.4)',
};

// Premium Dark Theme Palette (deep greys, bright accent contrast)
const darkColors = {
  accent: '#FF7043',
  accentDark: '#D84315',
  accentLight: '#FFAB91',
  accentSoft: '#2C1D15',

  background: '#121212',
  surface: '#1E1E1E',
  card: '#1E1E1E',
  border: '#2A2A2A',
  divider: '#222222',

  text: '#F5F5F3',
  textMuted: '#9D9C99',
  textInverse: '#121212',

  success: '#4CAF50',
  danger: '#EF5350',
  warning: '#FFB74D',

  muted: '#757575',
  skeleton: '#2A2A2A',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // 'light' or 'dark'
  const [themeMode, setThemeModeState] = useState('system'); // 'light', 'dark', or 'system'
  const [initialized, setInitialized] = useState(false);

  // Restore saved theme mode on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
          setThemeModeState(saved);
        }
      } catch (e) {
        // Fallback to default 'system'
      } finally {
        setInitialized(true);
      }
    })();
  }, []);

  const setThemeMode = async (mode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (e) {
      // Ignore write errors
    }
  };

  // Determine active scheme
  const activeScheme =
    themeMode === 'system' ? systemScheme || 'light' : themeMode;

  const colors = activeScheme === 'dark' ? darkColors : lightColors;
  const isDark = activeScheme === 'dark';

  const value = {
    colors,
    spacing,
    radius,
    themeMode,
    setThemeMode,
    isDark,
    statusBarStyle: isDark ? 'light' : 'dark',
  };

  if (!initialized) {
    return null; // Prevents flashing during restoration
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

export default ThemeContext;
