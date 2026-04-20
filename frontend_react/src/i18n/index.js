import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ko from './locales/ko.json';
import en from './locales/en.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';

const resources = {
  ko: { translation: ko },
  en: { translation: en },
  ja: { translation: ja },
  zh: { translation: zh },
};

function setHtmlLang(lng) {
  const base = (lng || 'ko').split('-')[0];
  document.documentElement.lang = base === 'zh' ? 'zh-Hans' : base;
}

i18n.on('languageChanged', setHtmlLang);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ko',
    supportedLngs: ['ko', 'en', 'ja', 'zh'],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'f2c_lang',
    },
  })
  .then(() => setHtmlLang(i18n.language));

export default i18n;
