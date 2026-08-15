/**
 * 読む環境変数の名前。直書きすると綴りのゆらぎが**実行時まで表面化しない** —
 * 未設定として扱われ、既定値で静かに動くか、起動時に「設定されていません」と
 * 言われて設定済みの `.env` を睨むことになる。
 *
 * `.env.example` が説明の本体で、ここはそれを型に写したもの。
 */
export const EnvName = {
  /** DB の接続先。未設定だと Bun.sql が**既定の接続先へフォールバックする**。 */
  DatabaseUrl: "DATABASE_URL",
  /** アクセストークン (JWT / HS256) の署名鍵。32 文字以上を要求する。 */
  JwtSecret: "JWT_SECRET",
  /** Cookie に Secure を付けるか。既定は付ける ("false" のときだけ外す)。 */
  CookieSecure: "COOKIE_SECURE",
  /** Cookie の Domain。未設定なら発行したホストにだけ送られる。 */
  CookieDomain: "COOKIE_DOMAIN",
} as const;

export type EnvName = (typeof EnvName)[keyof typeof EnvName];
