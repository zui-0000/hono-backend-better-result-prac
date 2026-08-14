/**
 * API が読み書きする HTTP ヘッダ名。契約の CommonHeaders と対になる。
 * 直書きすると綴りのゆらぎ (X-Request-ID / X-Request-Id) が実行時まで表面化する。
 */
export const HttpHeader = {
  /** 相関 ID。リクエストから引き継ぎ、応答にも付与する。 */
  RequestId: "X-Request-Id",
  /** アクセストークンの運び先。契約の `@useAuth(BearerAuth)` と対になる。 */
  Authorization: "Authorization",
} as const;

export type HttpHeader = (typeof HttpHeader)[keyof typeof HttpHeader];
