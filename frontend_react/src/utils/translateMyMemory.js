/**
 * MyMemory 무료 번역(브라우저 직접 호출). 일일 한도·CORS 제한이 있을 수 있습니다.
 * @param {string} text
 * @param {string} targetLang i18n 코드: ko | en | ja | zh
 * @returns {Promise<string|null>}
 */
const TARGET = {
  ko: 'KO',
  en: 'EN-US',
  ja: 'JA',
  zh: 'ZH-CN',
};

function normalizeTarget(lang) {
  const base = (lang || 'ko').split('-')[0];
  return TARGET[base] || 'EN-US';
}

function chunkText(s, maxLen) {
  const t = String(s);
  if (t.length <= maxLen) return [t];
  const parts = [];
  let i = 0;
  while (i < t.length) {
    parts.push(t.slice(i, i + maxLen));
    i += maxLen;
  }
  return parts;
}

export async function translateToLanguage(text, targetI18nLang) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const target = normalizeTarget(targetI18nLang);
  const segments = chunkText(raw, 420);
  const out = [];

  for (const seg of segments) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(seg)}&langpair=Autodetect|${target}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.responseStatus !== 200) return null;
    const translated = data.responseData?.translatedText;
    if (typeof translated !== 'string') return null;
    out.push(translated);
  }

  return out.join('');
}
