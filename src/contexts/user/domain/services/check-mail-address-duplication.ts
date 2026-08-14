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
 * User 集約 1 つを見ても「他に同じメールアドレスの人が居るか」は判断できないため、
 * 集約にも値オブジェクトにも属さない。こうした集約をまたぐ不変条件を担うのが
 * ドメインサービス。ルールに名前を与えて 1 箇所に置き、呼ぶ順序 (= ユースケースの
 * 手順) だけを command 側に残す。
 *
 * リポジトリを読むが、依存するのは domain/ のポートだけで実装 (Drizzle) は知らない。
 *
 * `excluding` には重複判定から除外するユーザーを渡す。更新時に「自分自身がヒット
 * しただけ」を重複と誤判定しないために必要 (無いと、メールアドレスを変えない更新が
 * 常に失敗する)。
 */
export const checkMailAddressDuplication = async (
  deps: { readonly userRepository: UserRepository },
  mailAddress: MailAddress,
  options: { readonly excluding?: UserId } = {},
): Promise<Result<void, MailAddressDuplicationError | RepositoryError>> =>
  await Result.gen(async function* () {
    const found = yield* Result.await(
      deps.userRepository.findByMailAddress(mailAddress),
    );

    // 除外対象本人以外の誰かが使っていれば重複。
    if (found !== undefined && found.id !== options.excluding) {
      yield* new MailAddressDuplicationError({ mailAddress });
    }
    return Result.ok();
  });
