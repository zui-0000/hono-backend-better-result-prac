import type { Clock } from "~/shared/domain/clock";

import type { RefreshTokenRepository } from "../domain/refresh-token-repository";
import type { SessionRevoker } from "../public/session-revoker";

/**
 * SessionRevoker の実装 (アダプタ)。
 *
 * **SQL は書かない。担うのは配線と、失効時刻を決めることだけ。**
 * user から見えるのは動詞 1 つで、`RefreshTokenRepository` は覗けない。
 */
export const createSessionRevoker = (deps: {
  readonly refreshTokenRepository: RefreshTokenRepository;
  readonly clock: Clock;
}): SessionRevoker => ({
  revokeUserSessions: async ({ userId, excluding }) =>
    await deps.refreshTokenRepository.revokeUserSessions({
      userId,
      revokedAt: deps.clock.now(),
      excluding,
    }),
});
