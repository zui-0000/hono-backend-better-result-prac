import type { Result } from "better-result";

import type { RepositoryError } from "~/shared/errors/repository-error";

import type { UserId } from "../domain/model/value-objects/user-id";

/**
 * 認証情報の照合クエリのポート (読み取り側 / CQRS のクエリ経路)。
 *
 * **auth コンテキストの求めに応じて user が公開している面** (Customer/Supplier)。
 * `public/` に居るので他コンテキストから見える (`cross-context-public-only`)。
 *
 * `UserRepository` を渡さないのは、あれが書き込み側で `create` / `deleteById` まで
 * 握らせることになるから。ハッシュも返さない — 照合は user の業務ルールで、
 * auth に照合させると同じルールが 2 か所に生まれる。
 *
 * **失敗を区別しない。**「利用者が居ない」も「パスワードが違う」も `undefined`。
 * 書き分けると総当たりで登録の有無を判定できてしまう (アカウント列挙)。
 *
 * 入力は素の string、返す id は branded な `UserId`。入力は「照合してもらう材料」で
 * 変換は所有者 (user) の仕事、id は auth 側で RefreshToken 集約の項目になるため。
 */
export type VerifyCredentialsQueryService = {
  readonly execute: (params: {
    readonly mailAddress: string;
    readonly password: string;
  }) => Promise<Result<UserId | undefined, RepositoryError>>;
};
