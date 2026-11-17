import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './locales/zh.json';
import de from './locales/de.json';

const STORAGE_KEY = 'accounting.lang';
const DEFAULT_LANG = 'zh';

function getInitialLang(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ['zh', 'de'].includes(saved)) return saved;
  } catch {}
  return DEFAULT_LANG;
}

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    de: { translation: de },
  },
  lng: getInitialLang(),
  fallbackLng: DEFAULT_LANG,
  interpolation: { escapeValue: false },
  returnNull: false,
});

i18n.on('languageChanged', (lang) => {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  } catch {}
});

document.documentElement.lang = i18n.language;

export default i18n;