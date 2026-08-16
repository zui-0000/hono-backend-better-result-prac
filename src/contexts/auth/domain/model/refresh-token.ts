import * as z from "zod";

import { UserId } from "~/contexts/user/domain/model/value-objects/user-id";
import type { Clock } from "~/shared/domain/clock";
import type { UuidGenerator } from "~/shared/domain/uuid-generator";

import { RefreshTokenHash } from "./value-objects/refresh-token-hash";
import { RefreshTokenId } from "./value-objects/refresh-token-id";
import { SessionId } from "./value-objects/session-id";

/**
 * なぜ失効したか。**行に保存する値**で、`t_refresh_token.revoked_reason` に載る。
 *
 * 時刻だけでは足りない。猶予期間はローテーション専用の救済なので、理由を見ないと
 * ログアウトや盗難検出で切った券にも猶予が付き、**切ったはずのセッションが生き返る**。
 */
export const RevokedReasonEnum = {
  /** ローテーションで置き換えられた。猶予期間の対象。 */
  Rotated: "rotated",
  /** ログアウト / 盗難検出で切られた。猶予は与えない。 */
  Revoked: "revoked",
} as const;
export type RevokedReasonEnum =
  (typeof RevokedReasonEnum)[keyof typeof RevokedReasonEnum];

/**
 * RefreshToken 集約ルート。1 行 = 券 1 枚。
 *
 * `revokedAt` を NULL 許容にして**行を消さない**のは、「失効済みの券が使われた」を
 * 検出するため (盗難のサイン)。消すと、盗難の兆候が「知らない券」と区別できなくなる。
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
  // 定数から引く。リテラルを書き写すと、理由を足したときスキーマだけ知らないまま残る。
  revokedReason: z.enum(RevokedReasonEnum).nullable(),
  createdAt: z.date(),
});
export type RefreshToken = z.infer<typeof RefreshToken>;

/**
 * 券の寿命 (2 日)。**ローテーションのたびに引き直される**ので、使っている限り切れない。
 * 実際の意味は「最後に更新してから 2 日空いたら再ログイン」。
 *
 * **presentation の Cookie の Max-Age と同じ長さである必要がある**
 * (`refresh-cookie.ts` の `MAX_AGE_SECONDS`)。短いほうが先に効くので、ズレると
 * DB では生きている券をブラウザが捨てる (逆なら 401 が増える)。
 *
 * **presentation から直接は import できない** — `presentation-not-to-context-domain` が
 * 塞いでいる。揃っていることは `refresh-controller.test.ts` が固定している。
 */
export const REFRESH_TOKEN_TTL_MILLIS = 2 * 24 * 60 * 60 * 1000;

/**
 * 新しい券の集約を組み立てる (id を採番し、寿命を載せて未失効の状態で返す)。
 *
 * **`issue` と名乗らないのは、券そのものを作らないから。** 予測できない乱数を
 * 生成するのは `RefreshTokenIssuer.issue()` (infrastructure) で、ここは渡された
 * ハッシュを詰めるだけ。他のドメインの新規作成 (`createUser`) とも動詞が揃う。
 *
 * **セッションは渡されたものを引き継ぐ。** 券の id はローテーションのたびに変わるが、
 * セッションはログインからログアウトまで不変 — ここで採番すると、古いタブからの
 * ログアウトが「既に失効した行」を消しにいって空振りする。
 */
export const createRefreshToken = (
  deps: { readonly uuidGenerator: UuidGenerator; readonly clock: Clock },
  params: {
    readonly userId: UserId;
    readonly sessionId: SessionId;
    readonly tokenHash: RefreshTokenHash;
  },
): RefreshToken => {
  const timestamp = deps.clock.now();
  return {
    id: RefreshTokenId.parse(deps.uuidGenerator.generate()),
    sessionId: params.sessionId,
    tokenHash: params.tokenHash,
    userId: params.userId,
    expiresAt: new Date(timestamp.getTime() + REFRESH_TOKEN_TTL_MILLIS),
    revokedAt: null,
    revokedReason: null,
    createdAt: timestamp,
  };
};

/**
 * 失効させた券を返す。元の券は書き換えない。
 *
 * **理由をそのまま載せる。** 丸めると `classifyRefreshToken` の判定が変わり、
 * 猶予が消えて並行更新したタブが締め出される (逆向きなら切ったセッションが生き返る)。
 */
export const revokeRefreshToken = (
  deps: { readonly clock: Clock },
  token: RefreshToken,
  reason: RevokedReasonEnum,
): RefreshToken => ({
  ...token,
  revokedAt: deps.clock.now(),
  revokedReason: reason,
});

/**
 * 提示された券をどう扱うかの判定結果。**保存しない導出値**で、
 * `RevokedReasonEnum` (列の値) とは別物。呼び出し側は switch で網羅する。
 */
export const RefreshTokenState = {
  /** 未失効かつ期限内。そのまま差し替えてよい。 */
  Usable: "usable",
  /** ローテーション済みだが 30 秒以内。並行更新したタブの救済として通す。 */
  WithinGrace: "within-grace",
  /** ローテーション済みで猶予切れ。**盗難のサイン**なのでセッションごと切る。 */
  Reused: "reused",
  /** ログアウト / 盗難検出で切られた。理由が読めない行もここへ倒す。 */
  Revoked: "revoked",
  /** 寿命 (2 日) を過ぎた。失効の有無より先に判定される。 */
  Expired: "expired",
} as const;
export type RefreshTokenState =
  (typeof RefreshTokenState)[keyof typeof RefreshTokenState];

/** ローテーション直後に古い券を通す猶予 (30 秒)。並行更新したタブを締め出さないため。 */
const GRACE_PERIOD_MILLIS = 30 * 1000;

/**
 * 券の状態を判定する。
 *
 * **見る順に意味がある。** 期限を先に見るのは、切れた券に猶予を与えないため。
 * **理由が読めない行 (時刻はあるのに理由が無い) は `revoked` に倒す** —
 * 迷ったら猶予を与えないほうが安全側に落ちる。
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
  if (token.revokedReason !== RevokedReasonEnum.Rotated) {
    return RefreshTokenState.Revoked;
  }
  return at.getTime() - token.revokedAt.getTime() <= GRACE_PERIOD_MILLIS
    ? RefreshTokenState.WithinGrace
    : RefreshTokenState.Reused;
};
