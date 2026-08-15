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
import type { SharedDeps } from "~/shared/shared-deps";

/**
 * アプリケーションの合成ルート (composition root)。
 *
 * **「どの実装を使うか」を知っているのはこのファイルだけ。** domain / application /
 * presentation はポート (型) しか知らない。
 *
 * 組み立ても宣言と同じ単位で分けてある (`SharedDeps` / `UserDeps` / `AuthDeps`)。
 * コンテキストが要求を増やしたとき、**そのコンテキストの塊でコンパイルエラーになる**ので、
 * 平らな一覧に足すより足し先が分かりやすい。
 *
 * DI コンテナを置かないのは、TypeScript では引数を渡すだけで足りるから。
 * `src/` 直下に置くのは、contexts を import する唯一の層だから
 * (共有基盤 shared/ が個別コンテキストを知る構造を避ける)。
 */
export type AppDeps = UserDeps & AuthDeps;

export const appDeps = (params: {
  readonly db: Database;
  readonly accessTokenIssuer: AccessTokenIssuer;
  readonly cookieSettings: CookieSettings;
}): AppDeps => {
  const shared: SharedDeps = {
    // 起動時に環境変数を読んで組み立てたもの (main.ts)。
    accessTokenIssuer: params.accessTokenIssuer,
    uuidGenerator,
    clock,
  };

  // **リポジトリだけ先に作る。** 2 つのコンテキストが互いの公開面を要求しており
  // (user は sessionRevoker を、auth は verifyCredentialsQueryService を)、
  // その実装がどちらも相手のリポジトリを要るため。
  //
  // 局所名を集合名にしてあるのは、組み立て関数から create を外した結果、
  // 関数と出来上がりが同名になり `const userRepository = userRepository(db)` が
  // 書けなくなったため。
  const users = userRepository(params.db);
  const refreshTokens = refreshTokenRepository(params.db);

  const user: UserDeps = {
    ...shared,
    userRepository: users,
    getUserQueryService: getUserQueryService(params.db),
    passwordHasher,
    // auth が user へ公開している面 (Customer/Supplier の逆向き)。
    sessionRevoker: sessionRevoker({
      refreshTokenRepository: refreshTokens,
      clock,
    }),
  };

  const auth: AuthDeps = {
    ...shared,
    refreshTokenRepository: refreshTokens,
    refreshTokenIssuer,
    cookieSettings: params.cookieSettings,
    // user が auth へ公開している面 (Customer/Supplier)。
    verifyCredentialsQueryService: verifyCredentialsQueryService({
      userRepository: users,
      passwordHasher,
    }),
  };

  return { ...user, ...auth };
};
