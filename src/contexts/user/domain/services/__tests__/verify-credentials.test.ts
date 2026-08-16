import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { MailAddress } from "~/shared/domain/model/value-objects/mail-address";
import { Password } from "~/shared/domain/model/value-objects/password";
import type { PasswordHasher } from "~/shared/domain/password-hasher";
import { RepositoryError } from "~/shared/errors/repository-error";

import type { User } from "../../model/user";
import { UserHashedPassword } from "../../model/value-objects/user-hashed-password";
import { UserId } from "../../model/value-objects/user-id";
import { UserName } from "../../model/value-objects/user-name";
import type { UserRepository } from "../../user-repository";
import { verifyCredentials } from "../verify-credentials";

const ID = UserId.parse("019fa5bc-0000-7000-8000-000000000000");
const MAIL = MailAddress.parse("existing@example.com");
const PLAIN = Password.parse("password1234");

const user: User = {
  id: ID,
  name: UserName.parse("既存ユーザー"),
  mailAddress: MAIL,
  hashedPassword: UserHashedPassword.parse(
    "$argon2id$v=19$m=65536,t=2,p=1$c2FsdA$existing",
  ),
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const deps = (
  found: User | undefined,
  matched: boolean,
): {
  readonly userRepository: Pick<UserRepository, "findByMailAddress">;
  readonly passwordHasher: PasswordHasher;
} => ({
  userRepository: {
    findByMailAddress: async () => Result.ok(found),
  },
  passwordHasher: {
    hash: async () => user.hashedPassword,
    verify: async () => matched,
  },
});

describe(verifyCredentials.name, () => {
  test("一致する場合、その利用者の id を返すこと", async () => {
    const result = await verifyCredentials(deps(user, true), {
      mailAddress: MAIL,
      password: PLAIN,
    });

    expect(result.isOk() ? result.value : null).toBe(ID);
  });

  test("居ない場合と合わない場合で、どちらも undefined になること", async () => {
    // 書き分けると、総当たりでメールアドレスの登録有無を判定できてしまう
    // (アカウント列挙)。ここで畳んでいることが防御の実体。
    const notFound = await verifyCredentials(deps(undefined, true), {
      mailAddress: MAIL,
      password: PLAIN,
    });
    const wrongPassword = await verifyCredentials(deps(user, false), {
      mailAddress: MAIL,
      password: PLAIN,
    });

    expect(notFound.isOk() ? notFound.value : "err").toBeUndefined();
    expect(wrongPassword.isOk() ? wrongPassword.value : "err").toBeUndefined();
  });

  test("パスワードが違う場合、失敗ではなく undefined を返すこと", async () => {
    // 401 へ翻訳するのは呼び出し側の責務。ここで失敗にすると、
    // 「居ない」と「合わない」が型のうえで分かれてしまう。
    const result = await verifyCredentials(deps(user, false), {
      mailAddress: MAIL,
      password: PLAIN,
    });

    expect(result.isOk()).toBe(true);
  });

  test("居ない場合、照合そのものを行わないこと", async () => {
    let verified = 0;
    const d: Parameters<typeof verifyCredentials>[0] = {
      userRepository: {
        findByMailAddress: async () => Result.ok(undefined),
      },
      passwordHasher: {
        hash: async () => user.hashedPassword,
        verify: async () => {
          verified += 1;
          return true;
        },
      },
    };

    await verifyCredentials(d, { mailAddress: MAIL, password: PLAIN });

    // 引き当てられなければハッシュ計算 (~100ms) を払う理由が無い。
    expect(verified).toBe(0);
  });

  test("引き当てに失敗した場合、その失敗をそのまま返すこと", async () => {
    const d: Parameters<typeof verifyCredentials>[0] = {
      userRepository: {
        findByMailAddress: async () =>
          Result.err(
            new RepositoryError({ failure: "unavailable", cause: "db down" }),
          ),
      },
      passwordHasher: {
        hash: async () => user.hashedPassword,
        verify: async () => true,
      },
    };

    const result = await verifyCredentials(d, {
      mailAddress: MAIL,
      password: PLAIN,
    });

    // DB が落ちているのを「照合できなかった = 401」に畳むと、原因が消える。
    expect(result.isOk()).toBe(false);
    expect(result.isOk() ? null : result.error._tag).toBe("RepositoryError");
  });
});
