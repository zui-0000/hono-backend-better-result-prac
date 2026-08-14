import type { RefreshTokenHash } from "./model/value-objects/refresh-token-hash";

/**
 * 券の生成とハッシュ化を行うポート。
 *
 * 採番に `UuidGenerator` を使わないのは、券に必要なのが逆の性質 (**予測できないこと**)
 * だから。実装は暗号論的乱数を使う。
 *
 * **ハッシュだけ branded 型で返す。** 券 (平文) とハッシュはどちらも文字列で、
 * 取り違えると**平文の券がそのまま DB に入る**。両方 `string` にしていた頃は
 * 取り違えても型が通り、実行時の `RefreshTokenHash.parse` が throw して 500 に
 * なるだけだった。型を分ければ**コンパイルで止まる**。
 */
export type RefreshTokenIssuer = {
  /** 券とそのハッシュを 1 組で作る (平文は呼び出し側が返し、ハッシュだけ保存する)。 */
  readonly issue: () => Promise<{
    readonly token: string;
    readonly hash: RefreshTokenHash;
  }>;
  /** 提示された券をハッシュに直す (保存済みの行と突き合わせるため)。 */
  readonly hash: (token: string) => Promise<RefreshTokenHash>;
};
