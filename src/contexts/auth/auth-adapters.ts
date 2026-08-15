import { clock } from "~/shared/infrastructure/clock";
import type { Database } from "~/shared/infrastructure/db/database-client";

import { refreshTokenIssuer } from "./infrastructure/refresh-token-issuer";
import { refreshTokenRepository as repository } from "./infrastructure/refresh-token-repository";
import { sessionRevoker } from "./infrastructure/session-revoker";

/**
 * auth が所有する実装を組み立てる。**合成ルートだけが呼ぶ。**
 * 分けてある理由は `user-adapters.ts` と同じ。
 *
 * **user へ公開する面もここで組む** (`sessionRevoker`)。要るのは auth 自身の
 * リポジトリなので、相手のコンテキストを待たずに組める。
 */
export const authAdapters = (db: Database) => {
  const refreshTokenRepository = repository(db);

  return {
    refreshTokenRepository,
    refreshTokenIssuer,
    sessionRevoker: sessionRevoker({
      refreshTokenRepository,
      clock,
    }),
  };
};
