
"use client";

// This hook is currently UI-only and does not perform dynamic translations.
// Text is hardcoded in Spanish in the components.
// To re-enable dynamic translations, you would:
// 1. Restore or create locale JSON files (e.g., src/locales/en.json, src/locales/es.json).
// 2. Update the fetchTranslations function to load these files.
// 3. Update the 't' function to use the loaded translations.
// 4. Ensure components call 't(key)' for all display text.

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext'; 

const DEFAULT_LANGUAGE = 'es'; // Default to Spanish

export function useTranslation() {
  const { user } = useAuth();
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [isLoading, setIsLoading] = useState(true);
  // const [translations, setTranslations] = useState<Record<string, any>>({}); // Reverted: No dynamic loading

  useEffect(() => {
    const userLang = user?.preferences?.languagePreference;
    const effectiveLang = userLang || localStorage.getItem('pixelSphereLanguage') || DEFAULT_LANGUAGE;
    setLanguage(effectiveLang);
    setIsLoading(false); 
  }, [user?.preferences?.languagePreference]);
  
  // Reverted: fetchTranslations logic removed as dynamic loading is disabled.
  // const fetchTranslations = useCallback(async (lang: string) => { ... }, []);
  // useEffect(() => { fetchTranslations(language); }, [language, fetchTranslations]);

  const t = useCallback((key: string, _params?: Record<string, string | number>): string => {
    if (isLoading) return key; 

    // Since dynamic translations are disabled, this function will not use loaded JSON files.
    // It will return the key, or you could add a very small static map here if needed for specific cases
    // but the primary approach now is hardcoded Spanish in components.
    
    // Example of a small static map (mostly for demonstration as UI is hardcoded Spanish):
    const staticTextMap: Record<string, Record<string, string>> = {
        es: {
            "sidebar.gallery": "Galería",
            "gallery.title": "Galería",
            "settings.title": "Configuración",
             // Add more keys if there are isolated places still using t()
        },
        en: {
            "sidebar.gallery": "Gallery",
            "gallery.title": "Gallery",
            "settings.title": "Settings",
        }
        // Add other languages if needed for this minimal static lookup
    };
    
    return staticTextMap[language]?.[key] || staticTextMap[DEFAULT_LANGUAGE]?.[key] || key;
  }, [language, isLoading]);

  const changeLanguage = (newLang: string) => {
    setLanguage(newLang);
    localStorage.setItem('pixelSphereLanguage', newLang);
    // In a fully dynamic system, this would also trigger re-fetching translations
    // and potentially re-rendering the app. For now, it mainly updates preference.
    // If user object is updated in context, that should be handled by settingsActions.
  };

  return { t, currentLanguage: language, changeLanguage, isLoadingTranslations: isLoading };
}
