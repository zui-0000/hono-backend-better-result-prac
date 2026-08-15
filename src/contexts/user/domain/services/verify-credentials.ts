import { Result } from "better-result";

import type { MailAddress } from "~/shared/domain/model/value-objects/mail-address";
import type { Password } from "~/shared/domain/model/value-objects/password";
import type { PasswordHasher } from "~/shared/domain/password-hasher";
import type { RepositoryError } from "~/shared/errors/repository-error";

import { verifyUserPassword } from "../model/user";
import type { UserId } from "../model/value-objects/user-id";
import type { UserRepository } from "../user-repository";

/**
 * メールアドレスとパスワードの組で本人を特定する (ドメインサービス)。
 * 一致すればその利用者の id を返し、しなければ `undefined`。
 *
 * この関数を auth が直接呼ぶことはない。呼ぶと auth が `UserRepository` を握り、
 * user の書き込み側 (`create` / `deleteById`) まで触れるようになる。auth には
 * `public/verify-credentials-query-service.ts` のポートだけを見せる。
 */
export const verifyCredentials = (
  deps: {
    readonly userRepository: Pick<UserRepository, "findByMailAddress">;
    readonly passwordHasher: PasswordHasher;
  },
  mailAddress: MailAddress,
  password: Password,
): Promise<Result<UserId | undefined, RepositoryError>> =>
  Result.gen(async function* () {
    const user = yield* Result.await(
      deps.userRepository.findByMailAddress(mailAddress),
    );
    // 401 にせず undefined で返すのは、**401 にするかが呼び出し側の方針**だから。
    // ここは `public/` 越しに auth へ渡る面で、ドメインが答えるのは「この人は誰か」だけ。
    // (同じ照合を「削除前の再確認」に使うなら、正解は 401 とは限らない)
    if (user === undefined) {
      return Result.ok(undefined);
    }

    // **照合の失敗は握り潰して undefined に畳む。** ここを `yield*` で短絡させると
    // 「居ない」(undefined) と「合わない」(失敗) が呼び出し側から見分けられてしまう。
    // E に PasswordMismatchError が現れないのはそのため。
    const verified = await verifyUserPassword(deps, user, password);
    return Result.ok(verified.isOk() ? user.id : undefined);
  });
