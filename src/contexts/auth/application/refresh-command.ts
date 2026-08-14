import { Result } from "better-result";
import * as z from "zod";

import { orUnauthorized } from "~/shared/application/or-unauthorized";
import type { AccessTokenIssuer } from "~/shared/domain/access-token-issuer";
import type { Clock } from "~/shared/domain/clock";
import type { UuidGenerator } from "~/shared/domain/uuid-generator";
import type { RepositoryError } from "~/shared/errors/repository-error";
import { UnauthorizedError } from "~/shared/errors/unauthorized-error";

import {
  classifyRefreshToken,
  issueRefreshToken,
  type RefreshToken,
  RefreshTokenState,
  revokeRefreshToken,
  RevokedReason,
} from "../domain/model/refresh-token";
import { RefreshTokenHash } from "../domain/model/value-objects/refresh-token-hash";
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

/**
 * 券を差し替えて、新しい組を返す。
 *
 * **セッションは据え置く。** 採番し直すと更新のたびにログアウトの単位が変わり、
 * 古いタブからのログアウトが効かなくなる。
 */
const rotate = async (
  deps: RefreshCommandDeps,
  current: RefreshToken,
): Promise<Result<RefreshCommandOutput, RepositoryError>> =>
  await Result.gen(async function* () {
    const next = await deps.refreshTokenIssuer.issue();

    const issued = issueRefreshToken(deps, {
      userId: current.userId,
      sessionId: current.sessionId,
      tokenHash: RefreshTokenHash.parse(next.hash),
    });

    // 失効と発行は 1 つの単位。間で落ちるとクライアントは再ログインしか道が無くなる。
    yield* Result.await(
      deps.refreshTokenRepository.rotate({
        revoked: revokeRefreshToken(deps, current, RevokedReason.Rotated),
        issued,
      }),
    );

    const accessToken = await deps.accessTokenIssuer.issue({
      sub: current.userId,
      sid: current.sessionId,
    });

    return Result.ok({ accessToken, refreshToken: next.token });
  });

/**
 * アクセストークンを再発行する。
 *
 * 状態ごとの分岐を **switch にして網羅を型に見張らせる** — 「どれでもなければ
 * 差し替える」と書くと、新しい状態が黙って通ってしまう (Revoked を足したとき実際に起きた)。
 */
export const createRefreshCommand =
  (deps: RefreshCommandDeps) =>
  async (
    input: RefreshCommandInput,
  ): Promise<
    Result<RefreshCommandOutput, UnauthorizedError | RepositoryError>
  > =>
    await Result.gen(async function* () {
      // 券そのものは保存していないので、ハッシュに直してから引く。
      const presentedHash = RefreshTokenHash.parse(
        await deps.refreshTokenIssuer.hash(input.refreshToken),
      );

      const current = yield* orUnauthorized(
        await deps.refreshTokenRepository.findByTokenHash(presentedHash),
      );

      switch (classifyRefreshToken(deps, current)) {
        // usable / within-grace はどちらも通常どおり差し替える。
        case RefreshTokenState.Usable:
        case RefreshTokenState.WithinGrace:
          return await rotate(deps, current);

        // 猶予期間の外で使われた = 盗難のサイン。**そのセッションだけ**切る
        // (猶予を入れてもなお誤検出は起こりうるので、全端末は落とさない)。
        case RefreshTokenState.Reused: {
          yield* Result.await(
            deps.refreshTokenRepository.revokeSession({
              sessionId: current.sessionId,
              revokedAt: deps.clock.now(),
            }),
          );
          return Result.err(new UnauthorizedError());
        }

        // 既に切られている / 期限切れ。追加の防御は要らない。
        case RefreshTokenState.Revoked:
        case RefreshTokenState.Expired:
          return Result.err(new UnauthorizedError());
      }
    });
