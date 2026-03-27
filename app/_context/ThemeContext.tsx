import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

// ── Color Tokens ────────────────────────────────────────────────────────────

export const LightTheme = {
    // Backgrounds
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F5F9',
    card: '#FFFFFF',
    cardBorder: '#E2E8F0',

    // Text
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    textInverse: '#FFFFFF',

    // Accents
    primary: '#3B82F6',
    primaryLight: '#EFF6FF',
    secondary: '#6366F1',
    secondaryLight: '#EEF2FF',
    accent: '#10B981',

    // Status
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',

    // Tab bar
    tabBar: '#FFFFFF',
    tabBorder: '#F1F5F9',
    tabIconActive: '#3B82F6',
    tabIconInactive: '#94A3B8',

    // Input
    inputBg: '#FFFFFF',
    inputBorder: '#E2E8F0',
    inputText: '#1E293B',
    placeholder: '#94A3B8',

    // Misc
    shadow: '#000',
    overlay: 'rgba(0,0,0,0.5)',
    separator: '#E2E8F0',
    isDark: false,
};

export const DarkTheme = {
    // Backgrounds
    background: '#0F172A',
    surface: '#1E293B',
    surfaceAlt: '#334155',
    card: '#1E293B',
    cardBorder: '#334155',

    // Text
    text: '#F1F5F9',
    textSecondary: '#CBD5E1',
    textMuted: '#64748B',
    textInverse: '#0F172A',

    // Accents
    primary: '#60A5FA',
    primaryLight: '#1E3A5F',
    secondary: '#818CF8',
    secondaryLight: '#312E81',
    accent: '#34D399',

    // Status
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',

    // Tab bar
    tabBar: '#1E293B',
    tabBorder: '#334155',
    tabIconActive: '#60A5FA',
    tabIconInactive: '#64748B',

    // Input
    inputBg: '#334155',
    inputBorder: '#475569',
    inputText: '#F1F5F9',
    placeholder: '#64748B',

    // Misc
    shadow: '#000',
    overlay: 'rgba(0,0,0,0.7)',
    separator: '#334155',
    isDark: true,
};

export type ThemeColors = typeof LightTheme;

// ── Context ─────────────────────────────────────────────────────────────────

interface ThemeContextValue {
    colors: ThemeColors;
    isDark: boolean;
    toggle: () => void;
    setMode: (mode: 'light' | 'dark' | 'system') => void;
    mode: 'light' | 'dark' | 'system';
}

const ThemeContext = createContext<ThemeContextValue>({
    colors: LightTheme,
    isDark: false,
    toggle: () => { },
    setMode: () => { },
    mode: 'system',
});

export const useTheme = () => useContext(ThemeContext);

const STORAGE_KEY = 'doctorchat_theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemScheme = useColorScheme();
    const [mode, setModeState] = useState<'light' | 'dark' | 'system'>('system');

    // Load saved preference
    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_KEY);
                if (saved === 'light' || saved === 'dark' || saved === 'system') {
                    setModeState(saved);
                }
            } catch { }
        })();
    }, []);

    const setMode = async (m: 'light' | 'dark' | 'system') => {
        setModeState(m);
        try { await AsyncStorage.setItem(STORAGE_KEY, m); } catch { }
    };

    const toggle = () => {
        const newMode = isDark ? 'light' : 'dark';
        setMode(newMode);
    };

    const isDark = false; // Forced to false to remove Dark Mode support
    const colors = LightTheme; // Always use LightTheme

    return (
        <ThemeContext.Provider value={{ colors, isDark, toggle, setMode, mode }}>
            {children}
        </ThemeContext.Provider>
    );
}
