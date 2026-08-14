import type { Result } from "better-result";

import type { RepositoryError } from "~/shared/errors/repository-error";

import type { RefreshToken } from "./model/refresh-token";
import type { RefreshTokenHash } from "./model/value-objects/refresh-token-hash";
import type { SessionId } from "./model/value-objects/session-id";

/**
 * RefreshToken 集約の永続化ポート。
 *
 * `rotate` が 1 メソッドなのは、「古い券を失効 + 新しい券を発行」の**間で落ちると
 * 再ログインしか道が無くなる**から。一貫性が要るならメソッドを分けない
 * (ポートのメソッド 1 つ = トランザクション 1 つ)。
 */
export type RefreshTokenRepository = {
  readonly create: (
    token: RefreshToken,
  ) => Promise<Result<void, RepositoryError>>;
  readonly findByTokenHash: (
    tokenHash: RefreshTokenHash,
  ) => Promise<Result<RefreshToken | undefined, RepositoryError>>;
  readonly rotate: (params: {
    readonly revoked: RefreshToken;
    readonly issued: RefreshToken;
  }) => Promise<Result<void, RepositoryError>>;
  /**
   * セッションの券を**すべて**失効させる。既に失効した行も対象にする —
   * 除外すると、ローテーション済みで猶予期間内の券が生き残ってセッションが復活する。
   */
  readonly revokeSession: (params: {
    readonly sessionId: SessionId;
    readonly revokedAt: Date;
  }) => Promise<Result<void, RepositoryError>>;
};
