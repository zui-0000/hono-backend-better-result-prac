import { authAdapters } from "~/contexts/auth/auth-adapters";
import type { AuthDeps } from "~/contexts/auth/auth-deps";
import { userAdapters } from "~/contexts/user/user-adapters";
import type { UserDeps } from "~/contexts/user/user-deps";
import { database } from "~/shared/infrastructure/db/database-client";
import { EnvName } from "~/shared/infrastructure/env-name";
import {
  type Environment,
  requireEnv,
} from "~/shared/infrastructure/require-env";
import { sharedAdapters } from "~/shared/shared-adapters";

/**
 * アプリケーションの合成ルート (composition root)。
 *
 * **実装を組み立てるのは合成ルートだけ** — このファイルと、各所有者が持つ
 * `<ctx>-adapters.ts` / `shared-adapters.ts` の一群を指す。domain / application /
 * presentation はポート (型) しか知らない。
 *
 * 1 ファイルに集めない理由は、どの実装を使うかを**所有者の隣に置く**ため。
 * ここに残るのは 3 つを合流させることだけ。
 *
 * 引数は環境そのもの。**ポートを受け取らない** — どの実装を使うかは合成ルートの
 * 仕事で、呼ぶ側 (main.ts) に持たせると「起動の入口が実装を知っている」形になる。
 * 設定の不足で落ちるのは `requireEnv` の中で、起動時に読みきる性質は変わらない。
 *
 * 守るべき保証 (ポート側の層が実装に到達しない) はファイル数ではなく
 * `no-indirect-path-to-impl` が見張っている。
 *
 * DI コンテナを置かないのは、TypeScript では引数を渡すだけで足りるから。
 * `src/` 直下に置くのは、contexts を import する唯一の層だから
 * (共有基盤 shared/ が個別コンテキストを知る構造を避ける)。
 */
export type AppDeps = UserDeps & AuthDeps;

export const appDeps = (env: Environment): AppDeps => {
  const db = database(requireEnv(env, EnvName.DatabaseUrl));

  return {
    ...sharedAdapters(env),
    ...userAdapters(db),
    ...authAdapters(db),
  };
};
