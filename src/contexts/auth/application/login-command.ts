import { Result } from "better-result";
import * as z from "zod";

import type { VerifyCredentialsQueryService } from "~/contexts/user/public/verify-credentials-query-service";
import type { AccessTokenIssuer } from "~/shared/domain/access-token-issuer";
import type { Clock } from "~/shared/domain/clock";
import type { UuidGenerator } from "~/shared/domain/uuid-generator";
import type { RepositoryError } from "~/shared/errors/repository-error";
import { UnauthorizedError } from "~/shared/errors/unauthorized-error";

import { createRefreshToken } from "../domain/model/refresh-token";
import { SessionId } from "../domain/model/value-objects/session-id";
import type { RefreshTokenIssuer } from "../domain/refresh-token-issuer";
import type { RefreshTokenRepository } from "../domain/refresh-token-repository";

export const LoginCommandInput = z.object({
  mailAddress: z.string(),
  password: z.string(),
});
export type LoginCommandInput = z.infer<typeof LoginCommandInput>;

export type LoginCommandOutput = {
  readonly accessToken: string;
  readonly refreshToken: string;
};

export type LoginCommandError = UnauthorizedError | RepositoryError;

/**
 * メールアドレスとパスワードで券を発行する。
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
  (
    input: LoginCommandInput,
  ): Promise<Result<LoginCommandOutput, LoginCommandError>> =>
    Result.gen(async function* () {
      // 「居ない」と「合わない」は user 側 (verifyCredentials) で既に undefined へ
      // 畳まれている。**ここに届く時点で分岐する材料が無い**ので、畳まれたまま 401 へ。
      // 書き分けられるとしたら畳む側で、そこは verify-credentials.test.ts が見張る。
      const userId = yield* Result.await(
        deps.verifyCredentialsQueryService.execute(input),
      );
      if (userId === undefined) {
        return Result.err(new UnauthorizedError());
      }

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
