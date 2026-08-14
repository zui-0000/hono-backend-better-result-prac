import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { MailAddress } from "~/shared/domain/model/value-objects/mail-address";
import { RepositoryError } from "~/shared/errors/repository-error";

import type { User } from "../../model/user";
import { UserHashedPassword } from "../../model/value-objects/user-hashed-password";
import { UserId } from "../../model/value-objects/user-id";
import { UserName } from "../../model/value-objects/user-name";
import type { UserRepository } from "../../user-repository";
import { checkMailAddressDuplication } from "../check-mail-address-duplication";

const SELF = UserId.parse("019fa5bc-0000-7000-8000-000000000000");
const OTHER = UserId.parse("019fa5bc-2222-7000-8000-000000000000");
const MAIL = MailAddress.parse("taken@example.com");

const makeUser = (id: UserId): User => ({
  id,
  name: UserName.parse("既存ユーザー"),
  mailAddress: MAIL,
  hashedPassword: UserHashedPassword.parse(
    "$argon2id$v=19$m=65536,t=2,p=1$c2FsdA$existing",
  ),
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

/**
 * 引き当て結果だけを持つ偽物。
 *
 * **サービスが要求するのも `findByMailAddress` だけ**なので、これで型が満たせる。
 * ポート全体を要求していた頃は 6 メソッドを埋めるか `as` で黙らせるしかなく、
 * 後者だと足りないメソッドが呼ばれたときに実行時まで分からなかった。
 */
const repositoryReturning = (
  found: User | undefined,
): {
  readonly userRepository: Pick<UserRepository, "findByMailAddress">;
} => ({
  userRepository: {
    findByMailAddress: async () => Result.ok(found),
  },
});

describe(checkMailAddressDuplication.name, () => {
  test("誰も使っていなければ通ること", async () => {
    const result = await checkMailAddressDuplication(
      repositoryReturning(undefined),
      MAIL,
    );

    expect(result.isOk()).toBe(true);
  });

  test("他人が使っていれば MailAddressDuplicationError で落ちること", async () => {
    const result = await checkMailAddressDuplication(
      repositoryReturning(makeUser(OTHER)),
      MAIL,
    );

    expect(result.isOk()).toBe(false);
    expect(result.isOk() ? null : result.error._tag).toBe(
      "MailAddressDuplicationError",
    );
  });

  test("**excluding が自分自身なら重複と見なさないこと**", async () => {
    // これが無いと「メールアドレスを変えない更新」が常に 409 になる。
    const result = await checkMailAddressDuplication(
      repositoryReturning(makeUser(SELF)),
      MAIL,
      { excluding: SELF },
    );

    expect(result.isOk()).toBe(true);
  });

  test("excluding を渡しても、他人が使っていれば落ちること", async () => {
    const result = await checkMailAddressDuplication(
      repositoryReturning(makeUser(OTHER)),
      MAIL,
      { excluding: SELF },
    );

    expect(result.isOk()).toBe(false);
  });

  test("引き当てに失敗したら、その失敗をそのまま返すこと", async () => {
    // 重複の有無を判断できない状態を「重複なし」に畳むと、素通りしてしまう。
    const deps = {
      userRepository: {
        findByMailAddress: async () =>
          Result.err(
            new RepositoryError({ failure: "unavailable", cause: "db down" }),
          ),
      },
    };

    const result = await checkMailAddressDuplication(deps, MAIL);

    expect(result.isOk()).toBe(false);
    expect(result.isOk() ? null : result.error._tag).toBe("RepositoryError");
  });
});
