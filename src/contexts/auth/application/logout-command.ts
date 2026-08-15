import type { Result } from "better-result";
import * as z from "zod";

import type { Clock } from "~/shared/domain/clock";
import type { RepositoryError } from "~/shared/errors/repository-error";

import { SessionId } from "../domain/model/value-objects/session-id";
import type { RefreshTokenRepository } from "../domain/refresh-token-repository";

export const LogoutCommandInput = z.object({
  sessionId: SessionId,
});
export type LogoutCommandInput = z.infer<typeof LogoutCommandInput>;

export type LogoutCommandError = RepositoryError;

/**
 * セッションを終了する。**切る単位はセッション (sid) であって利用者 (sub) ではない** —
 * sub で切ると、スマホでログアウトしたら PC まで落ちる。
 *
 * 失効時刻は Clock から取る (DB の now() に任せない)。
 */
export const logoutCommand =
  (deps: {
    readonly refreshTokenRepository: RefreshTokenRepository;
    readonly clock: Clock;
  }) =>
  async (
    input: LogoutCommandInput,
  ): Promise<Result<void, LogoutCommandError>> =>
    await deps.refreshTokenRepository.revokeSession({
      sessionId: input.sessionId,
      revokedAt: deps.clock.now(),
    });
