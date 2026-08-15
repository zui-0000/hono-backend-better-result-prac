import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import { FIXED_UUID, makeUser, OTHER_UUID } from "~/__mocks__/data";
import type { User } from "~/contexts/user/domain/model/user";
import { UserName } from "~/contexts/user/domain/model/value-objects/user-name";
import { MailAddress } from "~/shared/domain/model/value-objects/mail-address";
import { RepositoryError } from "~/shared/errors/repository-error";

import { updateUserCommand } from "../update-user-command";

const VALID = {
  id: FIXED_UUID,
  actor: FIXED_UUID,
  name: "新しい名前",
  mailAddress: "updated@example.com",
};

describe(updateUserCommand.name, () => {
  describe("正常系", () => {
    test("本人の場合、名前とメールアドレスを更新すること", async () => {
      const updated: User[] = [];
      const deps = makeDeps({
        userRepository: {
          findById: async () => Result.ok(makeUser()),
          updateProfile: async (user) => {
            updated.push(user);
            return Result.ok();
          },
        },
      });

      const result = await updateUserCommand(deps)(VALID);

      expect(result.isOk()).toBe(true);
      expect(updated[0]?.name).toBe(UserName.parse(VALID.name));
      expect(updated[0]?.mailAddress).toBe(
        MailAddress.parse(VALID.mailAddress),
      );
      // パスワードは別の操作。ここで巻き戻ると変更が無かったことになる。
      expect(updated[0]?.hashedPassword).toBe(makeUser().hashedPassword);
    });

    test("自分が既に使っているメールアドレスの場合、重複と見なさないこと", async () => {
      // 重複検証に自分自身を除外して渡しているかを、振る舞いで見る。
      // 渡していないと**メールアドレスを変えない更新が常に 409 になる**。
      const deps = makeDeps({
        userRepository: {
          findById: async () => Result.ok(makeUser()),
          findByMailAddress: async () => Result.ok(makeUser()),
        },
      });

      const result = await updateUserCommand(deps)(VALID);

      expect(result.isOk()).toBe(true);
    });
  });

  describe("異常系", () => {
    test("他人の id の場合、ForbiddenError で落ち、引き当ても走らないこと", async () => {
      // 認可が先。他人の id を指定されたとき DB を引かずに落ちる。
      const calls: string[] = [];
      const deps = makeDeps({
        userRepository: {
          findById: async () => {
            calls.push("findById");
            return Result.ok(makeUser());
          },
        },
      });

      const result = await updateUserCommand(deps)({
        ...VALID,
        id: OTHER_UUID,
      });

      expect(result.isOk() ? null : result.error._tag).toBe("ForbiddenError");
      expect(calls).toStrictEqual([]);
    });

    test("存在しない場合、ResourceNotFoundError で落ちること", async () => {
      const deps = makeDeps();

      const result = await updateUserCommand(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe(
        "ResourceNotFoundError",
      );
    });

    test("他人が使っているメールアドレスの場合、MailAddressDuplicationError で落ちること", async () => {
      const updated: User[] = [];
      const deps = makeDeps({
        userRepository: {
          findById: async () => Result.ok(makeUser()),
          findByMailAddress: async () =>
            Result.ok(makeUser({ id: OTHER_UUID })),
          updateProfile: async (user) => {
            updated.push(user);
            return Result.ok();
          },
        },
      });

      const result = await updateUserCommand(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe(
        "MailAddressDuplicationError",
      );
      expect(updated).toStrictEqual([]);
    });

    test("更新の永続化に失敗した場合、その失敗をそのまま返すこと", async () => {
      const deps = makeDeps({
        userRepository: {
          findById: async () => Result.ok(makeUser()),
          updateProfile: async () =>
            Result.err(
              new RepositoryError({ failure: "unavailable", cause: "db down" }),
            ),
        },
      });

      const result = await updateUserCommand(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe("RepositoryError");
    });
  });
});
