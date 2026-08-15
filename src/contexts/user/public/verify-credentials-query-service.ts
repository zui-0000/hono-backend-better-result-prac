import type { Result } from "better-result";

import type { MailAddress } from "~/shared/domain/model/value-objects/mail-address";
import type { Password } from "~/shared/domain/model/value-objects/password";
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
 * 入出力とも値オブジェクトで受け渡す。`MailAddress` / `Password` は `shared/domain` の
 * **共有の語彙**なので、auth が持っても user の内部を知ることにはならない。
 * 素の string から値オブジェクトへの変換は、他のユースケースと同じく
 * **呼ぶ側 (loginCommand) の冒頭**で行う — 落ちたら契約とのズレ = バグなので throw させる。
 */
export type VerifyCredentialsQueryService = {
  readonly execute: (params: {
    readonly mailAddress: MailAddress;
    readonly password: Password;
  }) => Promise<Result<UserId | undefined, RepositoryError>>;
};
