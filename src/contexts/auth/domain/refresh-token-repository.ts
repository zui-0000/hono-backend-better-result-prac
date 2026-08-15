import type { Result } from "better-result";

import type { UserId } from "~/contexts/user/domain/model/value-objects/user-id";
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
   * セッションの券を**すべて**失効させる。ログアウトと盗難検出の出口。
   *
   * 既に失効した行も対象にする — 除外すると、ローテーション済みで猶予期間内の券が
   * 生き残ってセッションが復活する。
   *
   * **理由は `revoked` を書くこと** (引数に取らないのは、この操作に `rotated` が
   * ありえないから)。`classifyRefreshToken` は理由が `rotated` のときだけ猶予を
   * 与えるので、書き忘れると猶予は付かない代わりに「なぜ失効したか」が消え、
   * 行を残している意味 — 盗難の兆候を「知らない券」と区別すること — が半減する。
   *
   * 失効時刻は**既にある値を残す**こと (いつ最初に失効したかは監査の手掛かり)。
   */
  readonly revokeSession: (params: {
    readonly sessionId: SessionId;
    readonly revokedAt: Date;
  }) => Promise<Result<void, RepositoryError>>;
  /**
   * 利用者の券を**セッションを跨いで**すべて失効させる。退会とパスワード変更の出口。
   *
   * `revokeSession` と分けてあるのは切る単位が違うから。あちらは「この端末」、
   * こちらは「この人の全端末」。同じメソッドに畳むと、ログアウトが取り違えで
   * 全端末を落とす事故が書けてしまう。
   *
   * `excluding` に渡したセッションだけ残す (パスワード変更でいま操作している端末を
   * 落とさないため)。時刻と理由の扱いは `revokeSession` と同じ。
   */
  readonly revokeUserSessions: (params: {
    readonly userId: UserId;
    readonly revokedAt: Date;
    readonly excluding?: SessionId;
  }) => Promise<Result<void, RepositoryError>>;
};
