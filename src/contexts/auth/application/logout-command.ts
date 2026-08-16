import { Result } from "better-result";
import * as z from "zod";

import type { Clock } from "~/shared/domain/clock";
import type { RepositoryError } from "~/shared/errors/repository-error";

import { SessionId } from "../domain/model/value-objects/session-id";
import type { RefreshTokenRepository } from "../domain/refresh-token-repository";

export type LogoutCommandDeps = {
  readonly refreshTokenRepository: RefreshTokenRepository;
  readonly clock: Clock;
};

export type LogoutCommandInput = { readonly sessionId: string };

const LogoutCommandValues = z.object({ sessionId: SessionId });

export type LogoutCommandError = RepositoryError;

/**
 * セッションを終了する。**切る単位はセッション (`sessionId`) であって
 * 利用者 (`userId`) ではない** — 利用者で切ると、スマホでログアウトしたら
 * PC まで落ちる。
 *
 * 失効時刻は Clock から取る (DB の now() に任せない)。
 */
export const logoutCommand =
  (deps: LogoutCommandDeps) =>
  (input: LogoutCommandInput): Promise<Result<void, LogoutCommandError>> =>
    Result.gen(async function* () {
      const { sessionId } = LogoutCommandValues.parse(input);

      yield* Result.await(
        deps.refreshTokenRepository.revokeSession({
          sessionId,
          revokedAt: deps.clock.now(),
        }),
      );
      return Result.ok();
    });
