/**
 * 券の生成とハッシュ化を行うポート。
 *
 * 採番に `UuidGenerator` を使わないのは、券に必要なのが逆の性質 (**予測できないこと**)
 * だから。実装は暗号論的乱数を使う。
 */
export type RefreshTokenIssuer = {
  /** 券とそのハッシュを 1 組で作る (平文は呼び出し側が返し、ハッシュだけ保存する)。 */
  readonly issue: () => Promise<{
    readonly token: string;
    readonly hash: string;
  }>;
  /** 提示された券をハッシュに直す (保存済みの行と突き合わせるため)。 */
  readonly hash: (token: string) => Promise<string>;
};
