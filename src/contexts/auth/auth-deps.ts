import type { VerifyCredentialsQueryService } from "~/contexts/user/public/verify-credentials-query-service";
import type { AccessTokenIssuer } from "~/shared/domain/access-token-issuer";
import type { Clock } from "~/shared/domain/clock";
import type { CookieSettings } from "~/shared/domain/cookie-settings";
import type { UuidGenerator } from "~/shared/domain/uuid-generator";

import type { RefreshTokenIssuer } from "./domain/refresh-token-issuer";
import type { RefreshTokenRepository } from "./domain/refresh-token-repository";

/**
 * auth コンテキストを動かすのに必要なもの (要求側の宣言)。**ポートしか import しない。**
 *
 * user から見えるのは `public/` のポート 1 本だけ (`cross-context-public-only`)。
 */
export type AuthDeps = {
  readonly refreshTokenRepository: RefreshTokenRepository;
  readonly refreshTokenIssuer: RefreshTokenIssuer;
  readonly accessTokenIssuer: AccessTokenIssuer;
  readonly verifyCredentialsQueryService: VerifyCredentialsQueryService;
  // 券を HttpOnly Cookie で受け渡すため。user 側は要求しない。
  readonly cookieSettings: CookieSettings;
  readonly uuidGenerator: UuidGenerator;
  readonly clock: Clock;
};
