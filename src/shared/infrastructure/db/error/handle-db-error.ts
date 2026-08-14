import type { UnhandledException } from "better-result";

import { RepositoryError } from "~/shared/errors/repository-error";

import { classifyDbFailure } from "./classify-db-failure";

/**
 * DB の例外を `RepositoryError` に翻訳する。**チェーンの 1 段目に置く。**
 *
 * ```ts
 * (await Result.tryPromise(() => db.insert(...)))
 *   .mapError(handleDbError)                            // ← ここ
 *   .mapError(handleMailAddressDuplicationError(user))  // 続けて重ねられる
 *   .map(toVoid)
 * ```
 *
 * `Result.tryPromise` の `catch` に渡す形でも書けるが、そうすると**エラー翻訳が
 * 1 つだけオプションの中に埋まり、2 つ目以降とは別の場所に書くことになる**。
 * 段を揃えるほうが読む順と実行順が一致する。
 *
 * 内訳 (接続断・デッドロック等) の分類は `classifyDbFailure` が担い、ログにだけ出す。
 */
export const handleDbError = ({ cause }: UnhandledException): RepositoryError =>
  new RepositoryError({ ...classifyDbFailure(cause), cause });
