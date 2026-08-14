import * as z from "zod";

import { UserId } from "~/contexts/user/domain/model/value-objects/user-id";
import type { Clock } from "~/shared/domain/clock";
import type { UuidGenerator } from "~/shared/domain/uuid-generator";

import { RefreshTokenHash } from "./value-objects/refresh-token-hash";
import {
  generateRefreshTokenId,
  RefreshTokenId,
} from "./value-objects/refresh-token-id";
import { SessionId } from "./value-objects/session-id";

/** 券の寿命 (2 週間) と、ローテーション時の猶予期間 (30 秒)。 */
const TTL_MILLIS = 14 * 24 * 60 * 60 * 1000;
const GRACE_PERIOD_MILLIS = 30 * 1000;

/**
 * RefreshToken 集約ルート。
 *
 * `revokedAt` を NULL 許容にして**行を消さない**のは、「失効済みの券が使われた」を
 * 検出するため (盗難のサイン)。`revokedReason` まで持つのは、**猶予期間が
 * ローテーション専用の救済**だから — 理由を見ないと、ログアウトや盗難検出で
 * 切った券にも猶予が付き、**切ったはずのセッションが生き返る**。
 *
 * `userId` が他コンテキストの値オブジェクトなのは、値オブジェクトが
 * 「公表された言語」として越境を許されているため (`cross-context-public-only`)。
 */
export const RefreshToken = z.object({
  id: RefreshTokenId,
  sessionId: SessionId,
  tokenHash: RefreshTokenHash,
  userId: UserId,
  expiresAt: z.date(),
  revokedAt: z.date().nullable(),
  revokedReason: z.enum(["rotated", "revoked"]).nullable(),
  createdAt: z.date(),
});
export type RefreshToken = z.infer<typeof RefreshToken>;

export const RevokedReason = {
  /** ローテーションで置き換えられた。猶予期間の対象。 */
  Rotated: "rotated",
  /** ログアウト / 盗難検出で切られた。猶予は与えない。 */
  Revoked: "revoked",
} as const;
export type RevokedReason = (typeof RevokedReason)[keyof typeof RevokedReason];

export const RefreshTokenState = {
  Usable: "usable",
  WithinGrace: "within-grace",
  Reused: "reused",
  Revoked: "revoked",
  Expired: "expired",
} as const;
export type RefreshTokenState =
  (typeof RefreshTokenState)[keyof typeof RefreshTokenState];

export const issueRefreshToken = (
  deps: { readonly uuidGenerator: UuidGenerator; readonly clock: Clock },
  params: {
    readonly userId: UserId;
    readonly sessionId: SessionId;
    readonly tokenHash: RefreshTokenHash;
  },
): RefreshToken => {
  const timestamp = deps.clock.now();
  return {
    id: generateRefreshTokenId(deps.uuidGenerator),
    sessionId: params.sessionId,
    tokenHash: params.tokenHash,
    userId: params.userId,
    expiresAt: new Date(timestamp.getTime() + TTL_MILLIS),
    revokedAt: null,
    revokedReason: null,
    createdAt: timestamp,
  };
};

export const revokeRefreshToken = (
  deps: { readonly clock: Clock },
  token: RefreshToken,
  reason: RevokedReason,
): RefreshToken => ({
  ...token,
  revokedAt: deps.clock.now(),
  revokedReason: reason,
});

/**
 * 券の状態を判定する。**理由が読めない行 (時刻はあるのに理由が無い) は
 * `revoked` に倒す** — 迷ったら猶予を与えないほうが安全側に落ちる。
 */
export const classifyRefreshToken = (
  deps: { readonly clock: Clock },
  token: RefreshToken,
): RefreshTokenState => {
  const at = deps.clock.now();

  if (token.expiresAt.getTime() <= at.getTime()) {
    return RefreshTokenState.Expired;
  }
  if (token.revokedAt === null) {
    return RefreshTokenState.Usable;
  }
  if (token.revokedReason !== RevokedReason.Rotated) {
    return RefreshTokenState.Revoked;
  }
  return at.getTime() - token.revokedAt.getTime() <= GRACE_PERIOD_MILLIS
    ? RefreshTokenState.WithinGrace
    : RefreshTokenState.Reused;
};
