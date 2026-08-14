import { Result } from "better-result";

import type { MailAddress } from "~/shared/domain/model/value-objects/mail-address";
import { MailAddressDuplicationError } from "~/shared/errors/mail-address-duplication-error";
import type { RepositoryError } from "~/shared/errors/repository-error";

import type { UserId } from "../model/value-objects/user-id";
import type { UserRepository } from "../user-repository";

/**
 * メールアドレスの重複を検証する (ドメインサービス)。
 * 「同じメールアドレスのユーザーは 2 人存在しない」という業務ルールを担う。
 *
 * `excluding` には重複判定から除外するユーザーを渡す。更新時に「自分自身がヒット
 * しただけ」を重複と誤判定しないために必要 (無いと、メールアドレスを変えない更新が
 * 常に失敗する)。
 */
export const checkMailAddressDuplication = async (
  deps: { readonly userRepository: Pick<UserRepository, "findByMailAddress"> },
  mailAddress: MailAddress,
  options: { readonly excluding?: UserId } = {},
): Promise<Result<void, MailAddressDuplicationError | RepositoryError>> =>
  await Result.gen(async function* () {
    const found = yield* Result.await(
      deps.userRepository.findByMailAddress(mailAddress),
    );

    // 除外対象本人以外の誰かが使っていれば重複。
    if (found !== undefined && found.id !== options.excluding) {
      yield* Result.err(new MailAddressDuplicationError({ mailAddress }));
    }
    return Result.ok();
  });
