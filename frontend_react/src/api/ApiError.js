/** API 계층에서 던지는 오류. UI에서는 code로 i18n 메시지를 매핑합니다. */
export class ApiError extends Error {
  constructor(code, serverDetail = null) {
    super(serverDetail || code);
    this.name = 'ApiError';
    this.code = code;
    this.serverDetail = serverDetail;
  }
}
