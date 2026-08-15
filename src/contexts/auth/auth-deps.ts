import type { VerifyCredentialsQueryService } from "~/contexts/user/public/verify-credentials-query-service";
import type { CookieSettings } from "~/shared/domain/cookie-settings";
import type { SharedDeps } from "~/shared/shared-deps";

import type { RefreshTokenIssuer } from "./domain/refresh-token-issuer";
import type { RefreshTokenRepository } from "./domain/refresh-token-repository";

/**
 * auth コンテキストを動かすのに必要なもの (要求側の宣言)。**ポートしか import しない。**
 *
 * 横断ポートは `SharedDeps` に寄せ、**ここには auth 固有のものだけ**を並べる。
 * user から見えるのは `public/` のポート 1 本だけ (`cross-context-public-only`)。
 */
export type AuthDeps = SharedDeps & {
  readonly refreshTokenRepository: RefreshTokenRepository;
  readonly refreshTokenIssuer: RefreshTokenIssuer;
  readonly verifyCredentialsQueryService: VerifyCredentialsQueryService;
  // 券を HttpOnly Cookie で受け渡すため。user 側は要求しない。
  readonly cookieSettings: CookieSettings;
};
