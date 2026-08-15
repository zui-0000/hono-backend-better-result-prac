import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import { FAKE_HASH, FIXED_UUID, makeUser } from "~/__mocks__/data";
import type { User } from "~/contexts/user/domain/model/user";
import { UserHashedPassword } from "~/contexts/user/domain/model/value-objects/user-hashed-password";
import { UserId } from "~/contexts/user/domain/model/value-objects/user-id";
import { MailAddress } from "~/shared/domain/model/value-objects/mail-address";
import { RepositoryError } from "~/shared/errors/repository-error";

import { createUserCommand } from "../create-user-command";

const VALID = {
  name: "テスト太郎",
  mailAddress: "new@example.com",
  password: "password1234",
};

describe(createUserCommand.name, () => {
  describe("正常系", () => {
    test("メールアドレスが空いている場合、採番した id を返すこと", async () => {
      const deps = makeDeps();

      const result = await createUserCommand(deps)(VALID);

      expect(result.isOk() ? result.value.id : null).toBe(
        UserId.parse(FIXED_UUID),
      );
    });

    test("メールアドレスが空いている場合、平文ではなくハッシュを保存すること", async () => {
      // **ここが平文流出の最後の関所。** 集約に詰める前にハッシュ化しているか、
      // 保存された値そのもので確かめる。
      const created: User[] = [];
      const deps = makeDeps({
        userRepository: {
          create: async (user) => {
            created.push(user);
            return Result.ok();
          },
        },
      });

      await createUserCommand(deps)(VALID);

      expect(created[0]?.hashedPassword).toBe(
        UserHashedPassword.parse(FAKE_HASH),
      );
      expect(created[0]?.mailAddress).toBe(
        MailAddress.parse(VALID.mailAddress),
      );
    });
  });

  describe("異常系", () => {
    test("メールアドレスが使われている場合、MailAddressDuplicationError で落ちること", async () => {
      const deps = makeDeps({
        userRepository: {
          findByMailAddress: async () => Result.ok(makeUser()),
        },
      });

      const result = await createUserCommand(deps)(VALID);

      expect(result.isOk()).toBe(false);
      expect(result.isOk() ? null : result.error._tag).toBe(
        "MailAddressDuplicationError",
      );
    });

    test("メールアドレスが使われている場合、ハッシュ計算も保存も走らないこと", async () => {
      // 重複検証を先に置いた理由そのもの。弾かれると分かっている入力に
      // argon2 の計算 (~100ms) を払わない。
      const calls: string[] = [];
      const deps = makeDeps({
        userRepository: {
          findByMailAddress: async () => Result.ok(makeUser()),
          create: async () => {
            calls.push("create");
            return Result.ok();
          },
        },
        passwordHasher: {
          hash: async () => {
            calls.push("hash");
            return FAKE_HASH;
          },
        },
      });

      await createUserCommand(deps)(VALID);

      expect(calls).toStrictEqual([]);
    });

    test("保存に失敗した場合、その失敗をそのまま返すこと", async () => {
      const deps = makeDeps({
        userRepository: {
          create: async () =>
            Result.err(
              new RepositoryError({ failure: "unavailable", cause: "db down" }),
            ),
        },
      });

      const result = await createUserCommand(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe("RepositoryError");
    });
  });

  describe("入力の変換", () => {
    test("契約を満たさない入力の場合、失敗ではなく throw すること", async () => {
      // 契約とドメインの制約は一致しているので、ここで落ちるのは**サーバのバグ**。
      // 400 に畳むと「あなたの入力が悪い」と嘘をつくことになる。
      const command = createUserCommand(makeDeps());

      await expect(command({ ...VALID, password: "short" })).rejects.toThrow();
    });
  });
});
