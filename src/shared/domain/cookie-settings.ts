/**
 * Cookie の属性のうち、**環境によって変わるもの**。
 *
 * `HttpOnly` / `SameSite` / `Path` / `Max-Age` は環境に依らない方針なので含めない
 * (利用側が定数で持つ。auth なら `contexts/auth/presentation/refresh-cookie.ts`)。
 * ここに置くのは本番とローカルで値が変わる 2 つだけ。
 *
 * presentation が使うのに shared/domain に置くのは構造上の帰結。presentation は
 * infrastructure を参照できず (`no-indirect-path-to-impl`)、`contexts/auth/domain/` も
 * `presentation-not-to-context-domain` が止める。`AccessTokenIssuer` と同じ位置。
 */
export type CookieSettings = {
  /**
   * `Secure` を付けるか。**既定は付ける** (`COOKIE_SECURE` で切る)。
   * 既定を「付けない」にすると、設定を忘れた本番が平文で券を配る。
   */
  readonly secure: boolean;
  /** `Domain`。未設定ならホストそのものに閉じる (サブドメインへ送らない)。 */
  readonly domain: string | undefined;
};
