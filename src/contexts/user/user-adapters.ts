import type { Database } from "~/shared/infrastructure/db/database-client";
import { passwordHasher } from "~/shared/infrastructure/password-hasher";

import { getUserQueryService } from "./infrastructure/get-user-query-service";
import { userRepository as repository } from "./infrastructure/user-repository";
import { verifyCredentialsQueryService } from "./infrastructure/verify-credentials-query-service";

/**
 * user が所有する実装を組み立てる。**合成ルートだけが呼ぶ。**
 *
 * `user-deps.ts` (要求の型) と分けてあるのは、あちらを presentation が
 * **型のためだけに** import しているから。実装を混ぜると user-routes.ts から
 * 全アダプタへ経路が通り、`no-indirect-path-to-impl` が落ちる (実測)。
 *
 * **auth へ公開する面もここで組む。** `verifyCredentialsQueryService` が要るのは
 * user 自身のリポジトリなので、相手のコンテキストを待たずに組める。
 * 相互に依存しているのは「ポートを要求する側」だけで、作る側は独立している。
 */
export const userAdapters = (db: Database) => {
  const userRepository = repository(db);

  return {
    userRepository,
    getUserQueryService: getUserQueryService(db),
    verifyCredentialsQueryService: verifyCredentialsQueryService({
      userRepository,
      passwordHasher,
    }),
  };
};
