import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import { FAKE_HASH, FIXED_UUID, makeUser, OTHER_UUID } from "~/__mocks__/data";
import type { User } from "~/contexts/user/domain/model/user";
import { UserHashedPassword } from "~/contexts/user/domain/model/value-objects/user-hashed-password";
import { RepositoryError } from "~/shared/errors/repository-error";

import { changePasswordCommand } from "../change-password-command";

const VALID = {
  id: FIXED_UUID,
  actor: FIXED_UUID,
  actorSession: OTHER_UUID,
  currentPassword: "currentpass1234",
  newPassword: "newpassword1234",
};

/**
 * 走った順と、失効に渡した値を記録する。
 *
 * `found` に既定値を置かないのは、JS の既定値が `undefined` を渡したときにも
 * 発動してしまうため (「居ない」を試したつもりが「居る」で走る)。
 */
const recording = (
  found: User | undefined,
): {
  readonly deps: ReturnType<typeof makeDeps>;
  readonly calls: string[];
  readonly revoked: unknown[];
  readonly updated: User[];
} => {
  const calls: string[] = [];
  const revoked: unknown[] = [];
  const updated: User[] = [];
  return {
    calls,
    revoked,
    updated,
    deps: makeDeps({
      userRepository: {
        findById: async () => {
          calls.push("findById");
          return Result.ok(found);
        },
        updatePassword: async (user) => {
          calls.push("updatePassword");
          updated.push(user);
          return Result.ok();
        },
      },
      sessionRevoker: {
        revokeUserSessions: async (params) => {
          calls.push("revokeUserSessions");
          revoked.push(params);
          return Result.ok();
        },
      },
    }),
  };
};

describe(changePasswordCommand.name, () => {
  describe("正常系", () => {
    test("現在のパスワードが正しい場合、失効させてから差し替えること", async () => {
      // 逆順だと、差し替えは通ったのに失効で落ちたとき盗まれた券が生き残り、
      // しかも再試行できない (currentPassword が既に古く 401 になる)。
      const { deps, calls } = recording(makeUser());

      const result = await changePasswordCommand(deps)(VALID);

      expect(result.isOk()).toBe(true);
      expect(calls).toStrictEqual([
        "findById",
        "revokeUserSessions",
        "updatePassword",
      ]);
    });

    test("現在のパスワードが正しい場合、操作中のセッションだけ残すこと", async () => {
      // 変えた本人まで追い出さないため。excluding が抜けると自分も落ちる。
      const { deps, revoked } = recording(makeUser());

      await changePasswordCommand(deps)(VALID);

      expect(revoked).toStrictEqual([
        { userId: FIXED_UUID, excluding: OTHER_UUID },
      ]);
    });

    test("現在のパスワードが正しい場合、新しいハッシュを保存すること", async () => {
      const { deps, updated } = recording(makeUser());

      await changePasswordCommand(deps)(VALID);

      expect(updated[0]?.hashedPassword).toBe(
        UserHashedPassword.parse(FAKE_HASH),
      );
      // 名前とメールアドレスが巻き戻らないこと。
      expect(updated[0]?.name).toBe(makeUser().name);
      expect(updated[0]?.mailAddress).toBe(makeUser().mailAddress);
    });
  });

  describe("異常系", () => {
    test("他人の id の場合、ForbiddenError で落ち、引き当ても走らないこと", async () => {
      const { deps, calls } = recording(makeUser());

      const result = await changePasswordCommand(deps)({
        ...VALID,
        id: OTHER_UUID,
      });

      expect(result.isOk() ? null : result.error._tag).toBe("ForbiddenError");
      expect(calls).toStrictEqual([]);
    });

    test("存在しない場合、ResourceNotFoundError で落ちること", async () => {
      const { deps } = recording(undefined);

      const result = await changePasswordCommand(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe(
        "ResourceNotFoundError",
      );
    });

    test("現在のパスワードが違う場合、失効も差し替えも走らないこと", async () => {
      // **トークンを盗まれてもパスワードは変えられない**という守り。
      // 打ち間違い 1 回で全端末が落ちると、盗難対策より先に自分が困る。
      const calls: string[] = [];
      const deps = makeDeps({
        userRepository: {
          findById: async () => Result.ok(makeUser()),
          updatePassword: async () => {
            calls.push("updatePassword");
            return Result.ok();
          },
        },
        passwordHasher: { verify: async () => false },
        sessionRevoker: {
          revokeUserSessions: async () => {
            calls.push("revokeUserSessions");
            return Result.ok();
          },
        },
      });

      const result = await changePasswordCommand(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe(
        "PasswordMismatchError",
      );
      expect(calls).toStrictEqual([]);
    });

    test("失効に失敗した場合、差し替えまで進まないこと", async () => {
      // ここで進むと、パスワードは変わったのに盗まれた券が生き残る。
      const calls: string[] = [];
      const deps = makeDeps({
        userRepository: {
          findById: async () => Result.ok(makeUser()),
          updatePassword: async () => {
            calls.push("updatePassword");
            return Result.ok();
          },
        },
        sessionRevoker: {
          revokeUserSessions: async () =>
            Result.err(
              new RepositoryError({ failure: "unavailable", cause: "db down" }),
            ),
        },
      });

      const result = await changePasswordCommand(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe("RepositoryError");
      expect(calls).toStrictEqual([]);
    });
  });
});
