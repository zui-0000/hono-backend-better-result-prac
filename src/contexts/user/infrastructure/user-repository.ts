import { Result } from "better-result";
import { eq, sql } from "drizzle-orm";

import { MailAddressDuplicationError } from "~/shared/errors/mail-address-duplication-error";
import type { RepositoryError } from "~/shared/errors/repository-error";
import type { Database } from "~/shared/infrastructure/db/database-client";
import { SqlState } from "~/shared/infrastructure/db/error/constants/sql-state";
import { handleDbError } from "~/shared/infrastructure/db/error/handle-db-error";
import { isSqlStateViolation } from "~/shared/infrastructure/db/error/postgres-error-reader";

import { User } from "../domain/model/user";
import type { UserRepository } from "../domain/user-repository";
import { tUser } from "./drizzle-schema";

const MAIL_ADDRESS_UNIQUE_CONSTRAINT = "t_user_mail_address_lower_unique";

/**
 * 一意制約違反をドメインのエラーへ翻訳する (`.mapError` に渡す)。
 *
 * アプリ側の事前チェックをすり抜けた同時挿入は**ここが最後の砦**。普段は
 * `checkMailAddressDuplication` が先に弾くので、この経路は通常テストで踏めない。
 * **消しても壊れて見えない**類なので、消さないこと。
 */
const handleMailAddressDuplicationError =
  (user: User) =>
  (error: RepositoryError): MailAddressDuplicationError | RepositoryError =>
    isSqlStateViolation(
      error.cause,
      SqlState.UniqueViolation,
      MAIL_ADDRESS_UNIQUE_CONSTRAINT,
    )
      ? new MailAddressDuplicationError({ mailAddress: user.mailAddress })
      : error;

/**
 * 先頭行を集約へ復元する。**parse の失敗は throw** —
 * DB の行がドメインの制約を満たさないのは、書き込み側かマイグレーションのバグ。
 */
const restoreUser = (
  rows: readonly (typeof tUser.$inferSelect)[],
): User | undefined => {
  const row = rows[0];
  return row === undefined ? undefined : User.parse(row);
};

export const userRepository = (db: Database): UserRepository => ({
  create: async (user) =>
    (
      await Result.tryPromise(() =>
        db.insert(tUser).values({
          id: user.id,
          name: user.name,
          mailAddress: user.mailAddress,
          hashedPassword: user.hashedPassword,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }),
      )
    )
      .mapError(handleDbError)
      .mapError(handleMailAddressDuplicationError(user))
      .map(() => void 0),

  updateProfile: async (user) =>
    (
      await Result.tryPromise(() =>
        db
          .update(tUser)
          .set({
            name: user.name,
            mailAddress: user.mailAddress,
            updatedAt: user.updatedAt,
          })
          .where(eq(tUser.id, user.id)),
      )
    )
      .mapError(handleDbError)
      .mapError(handleMailAddressDuplicationError(user))
      .map(() => void 0),

  // メールアドレスを書かないので一意制約違反は起こりえない (E にも現れない)。
  updatePassword: async (user) =>
    (
      await Result.tryPromise(() =>
        db
          .update(tUser)
          .set({
            hashedPassword: user.hashedPassword,
            updatedAt: user.updatedAt,
          })
          .where(eq(tUser.id, user.id)),
      )
    )
      .mapError(handleDbError)
      .map(() => void 0),

  findById: async (id) =>
    (
      await Result.tryPromise(() =>
        db.select().from(tUser).where(eq(tUser.id, id)).limit(1),
      )
    )
      .mapError(handleDbError)
      .map(restoreUser),

  // 大小を無視して引く。保存は入力どおりで、同一性の判定だけ lower() で行う。
  findByMailAddress: async (mailAddress) =>
    (
      await Result.tryPromise(() =>
        db
          .select()
          .from(tUser)
          .where(sql`lower(${tUser.mailAddress}) = lower(${mailAddress})`)
          .limit(1),
      )
    )
      .mapError(handleDbError)
      .map(restoreUser),

  deleteById: async (id) =>
    (await Result.tryPromise(() => db.delete(tUser).where(eq(tUser.id, id))))
      .mapError(handleDbError)
      .map(() => void 0),
});
