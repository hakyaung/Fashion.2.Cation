/** API 오류를 사용자 표시용 문자열로 변환합니다. */
export function formatApiError(t, err) {
  if (err && err.name === 'ApiError') {
    if (err.serverDetail) return err.serverDetail;
    return t(`errors.${err.code}`);
  }
  return err?.message || t('errors.GENERIC');
}
