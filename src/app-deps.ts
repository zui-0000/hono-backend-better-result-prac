import type { AuthDeps } from "~/contexts/auth/auth-deps";
import { refreshTokenIssuer } from "~/contexts/auth/infrastructure/refresh-token-issuer";
import { refreshTokenRepository } from "~/contexts/auth/infrastructure/refresh-token-repository";
import { sessionRevoker } from "~/contexts/auth/infrastructure/session-revoker";
import { getUserQueryService } from "~/contexts/user/infrastructure/get-user-query-service";
import { userRepository } from "~/contexts/user/infrastructure/user-repository";
import { verifyCredentialsQueryService } from "~/contexts/user/infrastructure/verify-credentials-query-service";
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

export const appDeps = (params: {
  readonly db: Database;
  readonly accessTokenIssuer: AccessTokenIssuer;
  readonly cookieSettings: CookieSettings;
}): AppDeps => {
  // **局所名だけ集合名にしてある。** 組み立て関数から create を外した結果、
  // 関数と出来上がりが同名になり `const userRepository = userRepository(db)` が
  // 書けなくなったため。2 度使うものだけがここに出る (残りは下で直接呼ぶ)。
  const users = userRepository(params.db);
  const refreshTokens = refreshTokenRepository(params.db);

  return {
    // --- user ---
    userRepository: users,
    getUserQueryService: getUserQueryService(params.db),

    // --- user が auth へ公開している面 (Customer/Supplier) ---
    verifyCredentialsQueryService: verifyCredentialsQueryService({
      userRepository: users,
      passwordHasher,
    }),

    // --- auth ---
    refreshTokenRepository: refreshTokens,
    refreshTokenIssuer,

    // --- auth が user へ公開している面 (Customer/Supplier の逆向き) ---
    sessionRevoker: sessionRevoker({
      refreshTokenRepository: refreshTokens,
      clock,
    }),

    // --- 横断 ---
    // params 経由の 2 つは、起動時に環境変数を読んで組み立てたもの (main.ts)。
    accessTokenIssuer: params.accessTokenIssuer,
    cookieSettings: params.cookieSettings,
    passwordHasher,
    uuidGenerator,
    clock,
  };
};
