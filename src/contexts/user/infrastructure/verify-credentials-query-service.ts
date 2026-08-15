import { MailAddress } from "~/shared/domain/model/value-objects/mail-address";
import { Password } from "~/shared/domain/model/value-objects/password";
import type { PasswordHasher } from "~/shared/domain/password-hasher";

import { verifyCredentials } from "../domain/services/verify-credentials";
import type { UserRepository } from "../domain/user-repository";
import type { VerifyCredentialsQueryService } from "../public/verify-credentials-query-service";

/**
 * VerifyCredentialsQueryService の実装 (アダプタ)。
 *
 * **SQL は書かない。担うのは語彙の変換と配線だけ。** 照合そのものはドメインサービス
 * `verifyCredentials` にある。
 *
 * ポートが素の `string` を受けるのは **auth が user の語彙を持たない**ため。
 * その変換を担うのがここで、これは正しくアダプタの仕事。
 *
 * **parse の失敗を throw にする**のは、形式の検証を presentation が契約で済ませており、
 * その制約が値オブジェクトと同一だから。落ちたら契約とドメインがズレたということで、
 * それはバグ。畳んで 401 にすると**正しいパスワードで入れないのに通常の認証失敗と
 * 見分けがつかない**状態になる。
 */
export const verifyCredentialsQueryService = (deps: {
  readonly userRepository: UserRepository;
  readonly passwordHasher: PasswordHasher;
}): VerifyCredentialsQueryService => ({
  execute: ({ mailAddress, password }) =>
    verifyCredentials(
      deps,
      MailAddress.parse(mailAddress),
      Password.parse(password),
    ),
});
