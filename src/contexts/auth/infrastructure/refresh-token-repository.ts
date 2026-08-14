import { Result } from "better-result";
import { eq, sql } from "drizzle-orm";

import type { Database } from "~/shared/infrastructure/db/database-client";
import { handleDbError } from "~/shared/infrastructure/db/error/handle-db-error";

import { RefreshToken, RevokedReasonEnum } from "../domain/model/refresh-token";
import type { RefreshTokenRepository } from "../domain/refresh-token-repository";
import { tRefreshToken } from "./drizzle-schema";

/** parse の失敗は throw。DB の行がドメインの制約を満たさないのは書き込み側のバグ。 */
const restoreRefreshToken = (
  rows: readonly (typeof tRefreshToken.$inferSelect)[],
): RefreshToken | undefined => {
  const row = rows[0];
  return row === undefined ? undefined : RefreshToken.parse(row);
};

export const createRefreshTokenRepository = (
  db: Database,
): RefreshTokenRepository => ({
  create: async (token) =>
    (await Result.tryPromise(() => db.insert(tRefreshToken).values(token)))
      .mapError(handleDbError)
      .map(() => void 0),

  findByTokenHash: async (tokenHash) =>
    (
      await Result.tryPromise(() =>
        db
          .select()
          .from(tRefreshToken)
          .where(eq(tRefreshToken.tokenHash, tokenHash))
          .limit(1),
      )
    )
      .mapError(handleDbError)
      .map(restoreRefreshToken),

  // 失効と発行を 1 トランザクションで行う。間で落ちるとクライアントは
  // 再ログインしか道が無くなる。
  rotate: async ({ revoked, issued }) =>
    (
      await Result.tryPromise(() =>
        db.transaction(async (tx) => {
          await tx
            .update(tRefreshToken)
            .set({
              revokedAt: revoked.revokedAt,
              revokedReason: revoked.revokedReason,
            })
            .where(eq(tRefreshToken.id, revoked.id));
          await tx.insert(tRefreshToken).values(issued);
        }),
      )
    )
      .mapError(handleDbError)
      .map(() => void 0),

  // **セッションの行すべてを対象にする。** 既に失効している行も理由を revoked へ
  // 倒さないと、ローテーション済みで猶予期間内の券が生き残り、切ったはずの
  // セッションが数十秒使えてしまう (実測で踏んだ穴)。
  //
  // 失効時刻は coalesce で**既にある値を残す**。いつ最初に失効したかは監査の手掛かり。
  revokeSession: async ({ sessionId, revokedAt }) =>
    (
      await Result.tryPromise(() =>
        db
          .update(tRefreshToken)
          .set({
            revokedAt: sql`coalesce(${tRefreshToken.revokedAt}, ${revokedAt})`,
            revokedReason: RevokedReasonEnum.Revoked,
          })
          .where(eq(tRefreshToken.sessionId, sessionId)),
      )
    )
      .mapError(handleDbError)
      .map(() => void 0),
});
