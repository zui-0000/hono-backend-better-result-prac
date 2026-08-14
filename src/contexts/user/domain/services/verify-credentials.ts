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
 * 集約 1 つを見ても「この組み合わせが誰か」は判断できない (まず引き当てが要る)。
 * `checkMailAddressDuplication` と同じ形 (引き当て → 判定)。
 *
 * **「居ない」と「合わない」を区別しない。** 書き分けると、総当たりでメールアドレスの
 * 登録有無を判定できてしまう (アカウント列挙)。401 へ翻訳するのは呼び出し側の責務。
 *
 * この関数を auth が直接呼ぶことはない。呼ぶと auth が `UserRepository` を握り、
 * user の書き込み側 (`create` / `deleteById`) まで触れるようになる。auth には
 * `public/verify-credentials-query-service.ts` のポートだけを見せる。
 */
export const verifyCredentials = async (
  deps: {
    readonly userRepository: UserRepository;
    readonly passwordHasher: PasswordHasher;
  },
  mailAddress: MailAddress,
  password: Password,
): Promise<Result<UserId | undefined, RepositoryError>> =>
  await Result.gen(async function* () {
    const found = yield* Result.await(
      deps.userRepository.findByMailAddress(mailAddress),
    );
    if (found === undefined) {
      return Result.ok(undefined);
    }

    // 一致しなければ UnauthorizedError で失敗するので、undefined に畳む。
    const verified = await verifyUserPassword(deps, found, password);
    return Result.ok(verified.isOk() ? found.id : undefined);
  });
