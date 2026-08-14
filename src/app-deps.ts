import type { AuthDeps } from "~/contexts/auth/auth-deps";
import { refreshTokenIssuer } from "~/contexts/auth/infrastructure/refresh-token-issuer";
import { createRefreshTokenRepository } from "~/contexts/auth/infrastructure/refresh-token-repository";
import { createGetUserQueryService } from "~/contexts/user/infrastructure/get-user-query-service";
import { createUserRepository } from "~/contexts/user/infrastructure/user-repository";
import { createVerifyCredentialsQueryService } from "~/contexts/user/infrastructure/verify-credentials-query-service";
import type { UserDeps } from "~/contexts/user/user-deps";
import type { AccessTokenIssuer } from "~/shared/domain/access-token-issuer";
import type { CookieSettings } from "~/shared/domain/cookie-settings";
import { clock } from "~/shared/infrastructure/clock";
import type { Database } from "~/shared/infrastructure/db/database-client";
import { passwordHasher } from "~/shared/infrastructure/password-hasher";
import { uuidGenerator } from "~/shared/infrastructure/uuid-generator";

/**
 * アプリケーションの合成ルート (composition root)。
 *
 * **「どの実装を使うか」を知っているのはこのファイルだけ。** domain / application /
 * presentation はポート (型) しか知らない。
 *
 * 構築順の依存 (repository が db を要る、照合サービスが repository を要る) が
 * **そのまま代入の順序として現れる**。DI コンテナを置かないのは、
 * TypeScript では引数を渡すだけで足りるから。
 *
 * `src/` 直下に置くのは、contexts を import する唯一の層だから
 * (共有基盤 shared/ が個別コンテキストを知る構造を避ける)。
 */
export type AppDeps = UserDeps & AuthDeps;

export const createAppDeps = (params: {
  readonly db: Database;
  readonly accessTokenIssuer: AccessTokenIssuer;
  readonly cookieSettings: CookieSettings;
}): AppDeps => {
  const userRepository = createUserRepository(params.db);

  return {
    // --- user ---
    userRepository,
    getUserQueryService: createGetUserQueryService(params.db),

    // --- user が auth へ公開している面 (Customer/Supplier) ---
    verifyCredentialsQueryService: createVerifyCredentialsQueryService({
      userRepository,
      passwordHasher,
    }),

    // --- auth ---
    refreshTokenRepository: createRefreshTokenRepository(params.db),
    refreshTokenIssuer,

    // --- 横断 ---
    // params 経由の 2 つは、起動時に環境変数を読んで組み立てたもの (main.ts)。
    accessTokenIssuer: params.accessTokenIssuer,
    cookieSettings: params.cookieSettings,
    passwordHasher,
    uuidGenerator,
    clock,
  };
};
