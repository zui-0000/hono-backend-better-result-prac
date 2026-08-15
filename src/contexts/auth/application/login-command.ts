import { Result } from "better-result";
import * as z from "zod";

import type { VerifyCredentialsQueryService } from "~/contexts/user/public/verify-credentials-query-service";
import { orUnauthorized } from "~/shared/application/or-unauthorized";
import type { AccessTokenIssuer } from "~/shared/domain/access-token-issuer";
import type { Clock } from "~/shared/domain/clock";
import type { UuidGenerator } from "~/shared/domain/uuid-generator";
import type { RepositoryError } from "~/shared/errors/repository-error";
import type { UnauthorizedError } from "~/shared/errors/unauthorized-error";

import { createRefreshToken } from "../domain/model/refresh-token";
import { SessionId } from "../domain/model/value-objects/session-id";
import type { RefreshTokenIssuer } from "../domain/refresh-token-issuer";
import type { RefreshTokenRepository } from "../domain/refresh-token-repository";

/**
 * ログインの入力。契約の LoginRequest と 1 対 1。
 *
 * 値オブジェクトへ変換しないのは、**照合するのが user 側**だから。
 * auth はメールアドレスの形式もパスワードの長さも判断しない。
 */
export const LoginCommandInput = z.object({
  mailAddress: z.string(),
  password: z.string(),
});
export type LoginCommandInput = z.infer<typeof LoginCommandInput>;

export type LoginCommandOutput = {
  readonly accessToken: string;
  readonly refreshToken: string;
};

/**
 * メールアドレスとパスワードで券を発行する。
 *
 * **初のコンテキスト跨ぎ。** user が公開している `VerifyCredentialsQueryService`
 * だけを使い、`UserRepository` には触れない (触ると create / deleteById まで握る)。
 *
 * ログインごとに**新しいセッションを採番する**のが refresh との違い。
 * 据え置くと更新のたびにログアウトの単位が変わる。
 */
export const loginCommand =
  (deps: {
    readonly verifyCredentialsQueryService: VerifyCredentialsQueryService;
    readonly refreshTokenRepository: RefreshTokenRepository;
    readonly refreshTokenIssuer: RefreshTokenIssuer;
    readonly accessTokenIssuer: AccessTokenIssuer;
    readonly uuidGenerator: UuidGenerator;
    readonly clock: Clock;
  }) =>
  async (
    input: LoginCommandInput,
  ): Promise<Result<LoginCommandOutput, UnauthorizedError | RepositoryError>> =>
    await Result.gen(async function* () {
      // 「居ない」と「合わない」は user 側で既に畳まれているので、畳まれたまま 401 へ。
      const userId = yield* orUnauthorized(
        await deps.verifyCredentialsQueryService.execute(input),
      );

      const sessionId = SessionId.parse(deps.uuidGenerator.generate());
      const generated = await deps.refreshTokenIssuer.issue();

      yield* Result.await(
        deps.refreshTokenRepository.create(
          createRefreshToken(deps, {
            userId,
            sessionId,
            tokenHash: generated.hash,
          }),
        ),
      );

      // sid にセッションを載せるので、ログアウトはこの単位で効く。
      const accessToken = await deps.accessTokenIssuer.issue({
        sub: userId,
        sid: sessionId,
      });

      return Result.ok({ accessToken, refreshToken: generated.token });
    });
