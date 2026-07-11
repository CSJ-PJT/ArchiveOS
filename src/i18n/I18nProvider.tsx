import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { defaultLocale, normalizeLocale, readStoredLocale, t, type Locale, type TranslationKey } from ".";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  translate: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());
  const setLocale = (next: Locale) => setLocaleState(normalizeLocale(next));

  useEffect(() => {
    window.localStorage.setItem("archive.locale", locale);
    document.documentElement.lang = locale;
    document.documentElement.dataset.language = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    translate: (key) => t(key, locale),
  }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context) return context;
  return { locale: defaultLocale, setLocale: () => undefined, translate: (key: TranslationKey) => t(key, defaultLocale) };
}
