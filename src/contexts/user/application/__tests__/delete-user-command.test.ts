import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import { FIXED_UUID, makeUser, OTHER_UUID } from "~/__mocks__/data";
import type { User } from "~/contexts/user/domain/model/user";
import { RepositoryError } from "~/shared/errors/repository-error";

import { deleteUserCommand } from "../delete-user-command";

const VALID = { id: FIXED_UUID, actor: FIXED_UUID };

/**
 * 走った順を記録する。**順序そのものが仕様**なので、呼ばれた事実だけでは足りない。
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
} => {
  const calls: string[] = [];
  const revoked: unknown[] = [];
  return {
    calls,
    revoked,
    deps: makeDeps({
      userRepository: {
        findById: async () => {
          calls.push("findById");
          return Result.ok(found);
        },
        deleteById: async () => {
          calls.push("deleteById");
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

describe(deleteUserCommand.name, () => {
  describe("正常系", () => {
    test("本人かつ存在する場合、セッションを失効させてから削除すること", async () => {
      // 逆順だと、失効に失敗したとき「消えた利用者の券だけが生きている」状態が残り、
      // 再試行しても直らない (相手はもう居ないので 404 になる)。
      const { deps, calls } = recording(makeUser());

      const result = await deleteUserCommand(deps)(VALID);

      expect(result.isOk()).toBe(true);
      expect(calls).toStrictEqual([
        "findById",
        "revokeUserSessions",
        "deleteById",
      ]);
    });

    test("退会の場合、残すセッションを指定しないこと", async () => {
      // パスワード変更と違い、退会に「残す端末」は無い。
      const { deps, revoked } = recording(makeUser());

      await deleteUserCommand(deps)(VALID);

      expect(revoked).toStrictEqual([{ userId: FIXED_UUID }]);
    });
  });

  describe("異常系", () => {
    test("他人の id の場合、ForbiddenError で落ち、引き当ても走らないこと", async () => {
      // 認可が先。**他人の id を指定されたとき DB を引かずに落ちる。**
      const { deps, calls } = recording(makeUser());

      const result = await deleteUserCommand(deps)({
        id: OTHER_UUID,
        actor: FIXED_UUID,
      });

      expect(result.isOk() ? null : result.error._tag).toBe("ForbiddenError");
      expect(calls).toStrictEqual([]);
    });

    test("存在しない場合、ResourceNotFoundError で落ち、失効も削除も走らないこと", async () => {
      const { deps, calls } = recording(undefined);

      const result = await deleteUserCommand(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe(
        "ResourceNotFoundError",
      );
      expect(calls).toStrictEqual(["findById"]);
    });

    test("失効に失敗した場合、削除まで進まないこと", async () => {
      // ここで進むと、券が生きたまま利用者だけが消える。
      const calls: string[] = [];
      const deps = makeDeps({
        userRepository: {
          findById: async () => Result.ok(makeUser()),
          deleteById: async () => {
            calls.push("deleteById");
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

      const result = await deleteUserCommand(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe("RepositoryError");
      expect(calls).toStrictEqual([]);
    });
  });
});
