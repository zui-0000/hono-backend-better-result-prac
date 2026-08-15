import type { AccessTokenIssuer } from "~/shared/domain/access-token-issuer";
import type { Clock } from "~/shared/domain/clock";
import type { UuidGenerator } from "~/shared/domain/uuid-generator";

/**
 * **どのコンテキストも要る横断ポート。** 各 `<ctx>-deps.ts` がこれを重ねて宣言する。
 *
 * ここに置くのは「実際に全コンテキストが使っているもの」だけ。`passwordHasher` は
 * user だけ、`cookieSettings` は auth だけが使うので入れていない — 入れると
 * 「このコンテキストが何を要求するか」が名前で読めなくなる。
 *
 * `shared/` 直下に置くのは `contexts/<ctx>/<ctx>-deps.ts` と対にするため。
 * 実装は知らない (ポートの型だけを並べる)。
 */
export type SharedDeps = {
  // Bearer の検証は handleWithResult が行うため、認証を要求する経路が
  // 1 本でもあるコンテキストはこれを要求する。
  readonly accessTokenIssuer: AccessTokenIssuer;
  readonly uuidGenerator: UuidGenerator;
  readonly clock: Clock;
};
