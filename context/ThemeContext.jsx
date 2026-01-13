"use client";

import { createContext, useContext, useState, useEffect } from 'react';

const THEME_KEY = 'jflow_theme';

export const themes = [
    { id: 'midnight', name: 'Midnight', accent: '#889B9A', preview: ['#000000', '#181818', '#889B9A'] },
    { id: 'cyber-blue', name: 'Cyber Blue', accent: '#4FC3F7', preview: ['#050A18', '#0D1B2A', '#4FC3F7'] },
    { id: 'neon-lime', name: 'Neon Lime', accent: '#A0E515', preview: ['#0A0F0A', '#1A1F1A', '#A0E515'] },
    { id: 'aurora', name: 'Aurora', accent: '#E040FB', preview: ['#0D0015', '#1A0A2E', '#E040FB'] },
];

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState('midnight');
    const [mounted, setMounted] = useState(false);

    // Load theme from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved && themes.find(t => t.id === saved)) {
            setThemeState(saved);
        }
        setMounted(true);
    }, []);

    // Apply theme to document
    useEffect(() => {
        if (mounted) {
            console.log('Setting theme:', theme);
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem(THEME_KEY, theme);
        }
    }, [theme, mounted]);

    const setTheme = (newTheme) => {
        if (themes.find(t => t.id === newTheme)) {
            setThemeState(newTheme);
        }
    };

    // Prevent flash of wrong theme
    if (!mounted) {
        return null;
    }

    return (
        <ThemeContext.Provider value={{ theme, setTheme, themes }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
