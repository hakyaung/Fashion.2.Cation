import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { translateToLanguage } from '../../utils/translateMyMemory';

/**
 * 사용자 생성 텍스트를 UI 언어로 번역(외부 API). 원문은 항상 보존합니다.
 */
export default function TranslatableText({ text, className, style, compact, invert }) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState('original'); // original | translated
  const [translated, setTranslated] = useState('');
  const [loading, setLoading] = useState(false);

  const raw = text == null ? '' : String(text);

  const handleTranslate = useCallback(async () => {
    if (mode === 'translated' && translated) {
      setMode('original');
      return;
    }
    setLoading(true);
    try {
      const next = await translateToLanguage(raw, i18n.language);
      if (next && next.trim() && next.trim() !== raw.trim()) {
        setTranslated(next);
        setMode('translated');
      } else {
        window.alert(t('ugc.translationUnavailable'));
      }
    } catch {
      window.alert(t('ugc.translationFail'));
    } finally {
      setLoading(false);
    }
  }, [i18n.language, mode, raw, t, translated]);

  if (!raw.trim()) return null;

  const display = mode === 'translated' && translated ? translated : raw;

  return (
    <span className={className} style={style}>
      <span style={{ whiteSpace: 'pre-wrap' }}>{display}</span>
      <button
        type="button"
        className="ugc-translate-btn"
        onClick={(e) => {
          e.stopPropagation();
          handleTranslate();
        }}
        disabled={loading}
        style={{
          marginLeft: compact ? 6 : 8,
          fontSize: compact ? 11 : 12,
          border: 'none',
          background: 'transparent',
          color: invert ? 'rgba(255,255,255,0.95)' : 'var(--rust)',
          cursor: loading ? 'wait' : 'pointer',
          textDecoration: 'underline',
          padding: 0,
          verticalAlign: 'baseline',
        }}
      >
        {loading
          ? t('ugc.translating')
          : mode === 'translated' && translated
            ? t('ugc.showOriginal')
            : t('ugc.translate')}
      </button>
    </span>
  );
}
