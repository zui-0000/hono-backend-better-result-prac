/**
 * Cookie の属性のうち、**環境によって変わるもの**。
 *
 * `HttpOnly` / `SameSite` / `Path` / `Max-Age` は環境に依らない方針なので含めない
 * (利用側が定数で持つ。auth なら `contexts/auth/presentation/refresh-cookie.ts`)。
 * ここに置くのは本番とローカルで値が変わる 2 つだけ。
 *
 * **これはポートではない。** 隣の `Clock` や `PasswordHasher` と違って振る舞いを持たず、
 * ドメインからも参照されない (使うのは auth の presentation だけ)。
 * それでも `domain/` に居るのは**他に置ける場所が無いから** — presentation は
 * infrastructure を参照できず、`shared/presentation/` に置くと今度は実装
 * (`readCookieSettings`) がそこを import できない。境界ルールの帰結であって、
 * ここが正しい場所だからではない。
 *
 * 置き場の再検討は [`docs/TODO.md`](../../../docs/TODO.md)。
 * 引き金は**環境で変わる設定値が 2 つ目に出てきたとき**。
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
