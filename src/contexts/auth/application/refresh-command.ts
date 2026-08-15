import { Result } from "better-result";
import * as z from "zod";

import type { AccessTokenIssuer } from "~/shared/domain/access-token-issuer";
import type { Clock } from "~/shared/domain/clock";
import type { UuidGenerator } from "~/shared/domain/uuid-generator";
import type { RepositoryError } from "~/shared/errors/repository-error";
import { UnauthorizedError } from "~/shared/errors/unauthorized-error";

import {
  classifyRefreshToken,
  createRefreshToken,
  type RefreshToken,
  RefreshTokenState,
  revokeRefreshToken,
  RevokedReasonEnum,
} from "../domain/model/refresh-token";
import type { RefreshTokenIssuer } from "../domain/refresh-token-issuer";
import type { RefreshTokenRepository } from "../domain/refresh-token-repository";

/**
 * 更新の入力。券に形式の制約を付けないのは**不透明トークンだから** —
 * 中身に意味を持たせない以上、ここで検証できるのは長さくらいで、
 * それは契約スキーマ (presentation) が既に見ている。
 */
export const RefreshCommandInput = z.object({
  refreshToken: z.string(),
});
export type RefreshCommandInput = z.infer<typeof RefreshCommandInput>;

export type RefreshCommandOutput = {
  readonly accessToken: string;
  readonly refreshToken: string;
};

export type RefreshCommandDeps = {
  readonly refreshTokenRepository: RefreshTokenRepository;
  readonly refreshTokenIssuer: RefreshTokenIssuer;
  readonly accessTokenIssuer: AccessTokenIssuer;
  readonly uuidGenerator: UuidGenerator;
  readonly clock: Clock;
};

export type RefreshCommandError = UnauthorizedError | RepositoryError;

/**
 * 券を差し替えて、新しい組を返す。
 *
 * **セッションは据え置く。** 採番し直すと更新のたびにログアウトの単位が変わり、
 * 古いタブからのログアウトが効かなくなる。
 */
const rotate = (
  deps: RefreshCommandDeps,
  current: RefreshToken,
): Promise<Result<RefreshCommandOutput, RepositoryError>> =>
  Result.gen(async function* () {
    const generated = await deps.refreshTokenIssuer.issue();

    const issued = createRefreshToken(deps, {
      userId: current.userId,
      sessionId: current.sessionId,
      tokenHash: generated.hash,
    });

    // 失効と発行は 1 つの単位。間で落ちるとクライアントは再ログインしか道が無くなる。
    yield* Result.await(
      deps.refreshTokenRepository.rotate({
        revoked: revokeRefreshToken(deps, current, RevokedReasonEnum.Rotated),
        issued,
      }),
    );

    const accessToken = await deps.accessTokenIssuer.issue({
      sub: current.userId,
      sid: current.sessionId,
    });

    return Result.ok({ accessToken, refreshToken: generated.token });
  });

/**
 * 盗難として扱う。**そのセッションだけ**切って 401 を返す
 * (猶予を入れてもなお誤検出は起こりうるので、全端末は落とさない)。
 *
 * **成功しても Err で終わる。** 失効できたかどうかに関わらず、呼び出し元へ返すのは
 * 401 だから。失効そのものに失敗したときだけ RepositoryError がそのまま出る。
 */
const revokeReusedSession = async (
  deps: RefreshCommandDeps,
  current: RefreshToken,
): Promise<Result<never, RefreshCommandError>> =>
  (
    await deps.refreshTokenRepository.revokeSession({
      sessionId: current.sessionId,
      revokedAt: deps.clock.now(),
    })
  ).andThen(() => Result.err(new UnauthorizedError()));

/**
 * 更新を断る。**断るだけで、追加の防御は要らない**
 * (既に切られている券も期限切れの券も、もうそれ以上悪用しようがない)。
 *
 * `revokeReusedSession` と同じ 401 で終わるが、あちらは**切ってから**断る。
 * 理由を書き分けないので、外から見た応答は区別がつかない。
 */
const denyRefresh = async (): Promise<Result<never, UnauthorizedError>> =>
  Result.err(new UnauthorizedError());

/** 状態ごとの応じ方。引数の形を揃えて 1 つの表に並べるための型。 */
type RefreshTokenStateHandler = (
  deps: RefreshCommandDeps,
  current: RefreshToken,
) => Promise<Result<RefreshCommandOutput, RefreshCommandError>>;

/**
 * 状態ごとの応じ方。
 *
 * `switch` で書くと網羅は保証されるが、`Result.gen` の中では抜けた枝が
 * `IteratorResult` / `AnyResult` の不一致に化けて、どの状態が無いかを言わない (実測)。
 */
const HANDLER_BY_REFRESH_TOKEN_STATE: Record<
  RefreshTokenState,
  RefreshTokenStateHandler
> = {
  // usable / within-grace はどちらも通常どおり差し替える。
  [RefreshTokenState.Usable]: rotate,
  [RefreshTokenState.WithinGrace]: rotate,

  // 猶予期間の外で使われた = 盗難のサイン。そのセッションだけ切る。
  [RefreshTokenState.Reused]: revokeReusedSession,

  // 既に切られている / 期限切れ。追加の防御は要らない。
  [RefreshTokenState.Revoked]: denyRefresh,
  [RefreshTokenState.Expired]: denyRefresh,
};

/**
 * アクセストークンを再発行する。**引く → 居るか見る → 状態で応じ方を選ぶ**の 3 段。
 */
export const refreshCommand =
  (deps: RefreshCommandDeps) =>
  (
    input: RefreshCommandInput,
  ): Promise<Result<RefreshCommandOutput, RefreshCommandError>> =>
    Result.gen(async function* () {
      // 券そのものは保存していないので、ハッシュに直してから引く。
      const presentedHash = await deps.refreshTokenIssuer.hash(
        input.refreshToken,
      );

      // 知らない券も、下の表が返す 401 と**同じ本文**に丸める。
      // 書き分けると「その券は実在する」と攻撃側に教えることになる
      // (refresh-controller.test.ts が 3 通りの理由で本文の一致を見ている)。
      const current = yield* Result.await(
        deps.refreshTokenRepository.findByTokenHash(presentedHash),
      );
      if (current === undefined) {
        return Result.err(new UnauthorizedError());
      }

      const refreshTokenState = classifyRefreshToken(deps, current);
      return await HANDLER_BY_REFRESH_TOKEN_STATE[refreshTokenState](
        deps,
        current,
      );
    });
