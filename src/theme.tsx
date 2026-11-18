import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Theme color interface
export interface ThemeColors {
  // Primary colors
  brand: string;
  /** Slack's action green, used for the send button and primary buttons. */
  primary: string;
  /** The two stops of the workspace header gradient, top-left to bottom-right. */
  headerFrom: string;
  headerTo: string;
  dark: string;
  darker: string;
  sidebar: string;

  // Text colors
  text: string;
  textBright: string;
  textSecondary: string;
  muted: string;

  // UI colors
  line: string;
  soft: string;
  inputBg: string;
  messageBg: string;
  cardBg: string;
  hoverBg: string;

  // Status colors
  danger: string;
  accent: string;
  success: string;
  warning: string;
  online: string;
  away: string;
  dnd: string;
}

// Light Theme
export const lightTheme: ThemeColors = {
  brand: '#611f69',
  primary: '#007a5a',
  headerFrom: '#3f0e40',
  headerTo: '#2f4318',
  dark: '#ffffff',
  darker: '#f8f8f8',
  sidebar: '#3f0e40',
  text: '#1d1c1d',
  textBright: '#ffffff',
  textSecondary: '#616061',
  muted: '#868686',
  line: '#dddddd',
  soft: '#f8f8f8',
  inputBg: '#ffffff',
  messageBg: '#ffffff',
  cardBg: '#f8f8f8',
  hoverBg: '#f0f0f0',
  danger: '#e01e5a',
  accent: '#1264a3',
  success: '#2eb67d',
  warning: '#ecb22e',
  online: '#2eb67d',
  away: '#ecb22e',
  dnd: '#e01e5a',
};

// Dark Theme
export const darkTheme: ThemeColors = {
  brand: '#611f69',
  primary: '#007a5a',
  headerFrom: '#3f0e40',
  headerTo: '#2f4318',
  dark: '#1a1d21',
  darker: '#121316',
  sidebar: '#19171d',
  text: '#d1d2d3',
  textBright: '#ffffff',
  textSecondary: '#ababad',
  muted: '#868686',
  line: '#393a3b',
  soft: '#222529',
  inputBg: '#222529',
  messageBg: '#1a1d21',
  cardBg: '#232529',
  hoverBg: '#27242c',
  danger: '#e01e5a',
  accent: '#1d9bd1',
  success: '#2eb67d',
  warning: '#ecb22e',
  online: '#2eb67d',
  away: '#ecb22e',
  dnd: '#e01e5a',
};

// True Dark Theme (AMOLED)
export const trueDarkTheme: ThemeColors = {
  brand: '#611f69',
  primary: '#007a5a',
  headerFrom: '#000000',
  headerTo: '#000000',
  dark: '#000000',
  darker: '#000000',
  sidebar: '#000000',
  text: '#e0e0e0',
  textBright: '#ffffff',
  textSecondary: '#a0a0a0',
  muted: '#707070',
  line: '#2a2a2a',
  soft: '#121212',
  inputBg: '#1a1a1a',
  messageBg: '#000000',
  cardBg: '#1a1a1a',
  hoverBg: '#1f1f1f',
  danger: '#e01e5a',
  accent: '#1d9bd1',
  success: '#2eb67d',
  warning: '#ecb22e',
  online: '#2eb67d',
  away: '#ecb22e',
  dnd: '#e01e5a',
};

// Legacy default colors (for backward compatibility)
export const defaultColors: ThemeColors = darkTheme;

export type ColorMode = 'system' | 'light' | 'dark' | 'trueDark';

interface ThemeContextType {
  colors: ThemeColors;
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  increaseContrast: boolean;
  setIncreaseContrast: (value: boolean) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  colors: darkTheme,
  colorMode: 'system',
  setColorMode: () => {},
  increaseContrast: false,
  setIncreaseContrast: () => {},
  isDark: true,
});

const THEME_STORAGE_KEY = 'ping-chat-theme-mode';
const CONTRAST_STORAGE_KEY = 'ping-chat-contrast';

// Storage helpers
const storage = {
  get: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  set: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [colorMode, setColorModeState] = useState<ColorMode>('system');
  const [increaseContrast, setIncreaseContrastState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load saved preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedMode = await storage.get(THEME_STORAGE_KEY);
        const savedContrast = await storage.get(CONTRAST_STORAGE_KEY);

        if (savedMode && ['system', 'light', 'dark', 'trueDark'].includes(savedMode)) {
          setColorModeState(savedMode as ColorMode);
        }
        if (savedContrast === 'true') {
          setIncreaseContrastState(true);
        }
      } catch {
        // Use defaults
      }
      setLoaded(true);
    };

    loadPreferences();
  }, []);

  const setColorMode = useCallback(async (mode: ColorMode) => {
    setColorModeState(mode);
    await storage.set(THEME_STORAGE_KEY, mode);
  }, []);

  const setIncreaseContrast = useCallback(async (value: boolean) => {
    setIncreaseContrastState(value);
    await storage.set(CONTRAST_STORAGE_KEY, String(value));
  }, []);

  // Determine actual theme based on mode and system preference
  const getColors = (): ThemeColors => {
    let baseColors: ThemeColors;

    switch (colorMode) {
      case 'light':
        baseColors = lightTheme;
        break;
      case 'dark':
        baseColors = darkTheme;
        break;
      case 'trueDark':
        baseColors = trueDarkTheme;
        break;
      case 'system':
      default:
        baseColors = systemColorScheme === 'dark' ? darkTheme : lightTheme;
        break;
    }

    // Apply contrast adjustments if enabled
    if (increaseContrast) {
      return {
        ...baseColors,
        text: baseColors === lightTheme ? '#000000' : '#ffffff',
        line: baseColors === lightTheme ? '#bbbbbb' : '#555555',
      };
    }

    return baseColors;
  };

  const colors = getColors();
  const isDark = colorMode === 'dark' || colorMode === 'trueDark' ||
    (colorMode === 'system' && systemColorScheme === 'dark');

  if (!loaded) {
    return null; // Or a loading spinner
  }

  return (
    <ThemeContext.Provider
      value={{
        colors,
        colorMode,
        setColorMode,
        increaseContrast,
        setIncreaseContrast,
        isDark,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Parse colors from API response (for workspace-specific themes)
export function parseThemeFromAPI(apiColors: Record<string, string>): Partial<ThemeColors> {
  const mapping: Record<string, keyof ThemeColors> = {
    primary_color: 'brand',
    background_color: 'dark',
    sidebar_color: 'sidebar',
    text_color: 'text',
    accent_color: 'accent',
  };

  const parsed: Partial<ThemeColors> = {};

  for (const [apiKey, themeKey] of Object.entries(mapping)) {
    if (apiColors[apiKey]) {
      parsed[themeKey] = apiColors[apiKey];
    }
  }

  return parsed;
}

// For backward compatibility
export const slackPurpleTheme = darkTheme;
export const slackBlueTheme = darkTheme;
