import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import { FIXED_UUID, OTHER_UUID } from "~/__mocks__/data";
import { RepositoryError } from "~/shared/errors/repository-error";

import { getUserQuery } from "../get-user-query";

const VALID = { id: FIXED_UUID, actor: FIXED_UUID };
const VIEW = { name: "既存ユーザー", mailAddress: "existing@example.com" };

describe(getUserQuery.name, () => {
  describe("正常系", () => {
    test("本人の場合、射影をそのまま返すこと", async () => {
      const deps = makeDeps({
        getUserQueryService: { execute: async () => Result.ok(VIEW) },
      });

      const result = await getUserQuery(deps)(VALID);

      expect(result.isOk() ? result.value : null).toStrictEqual(VIEW);
    });

    test("ポートには認可の主体を渡さないこと", async () => {
      // 渡して引く範囲を絞ると、**認可の失敗が 0 件 = 404** になり
      // 「認可の失敗は対象の有無に関わらず 403」の規則から外れる。
      const received: unknown[] = [];
      const deps = makeDeps({
        getUserQueryService: {
          execute: async (params) => {
            received.push(params);
            return Result.ok(VIEW);
          },
        },
      });

      await getUserQuery(deps)(VALID);

      expect(received).toStrictEqual([{ id: FIXED_UUID }]);
    });
  });

  describe("異常系", () => {
    test("他人の id の場合、ForbiddenError で落ち、DB を引かないこと", async () => {
      // 認可を先に置いた理由。引き当ててから判定すると、
      // 他人の id で「居ない = 404」が出て存在の有無が漏れる。
      const calls: string[] = [];
      const deps = makeDeps({
        getUserQueryService: {
          execute: async () => {
            calls.push("execute");
            return Result.ok(VIEW);
          },
        },
      });

      const result = await getUserQuery(deps)({
        id: OTHER_UUID,
        actor: FIXED_UUID,
      });

      expect(result.isOk() ? null : result.error._tag).toBe("ForbiddenError");
      expect(calls).toStrictEqual([]);
    });

    test("存在しない場合、ResourceNotFoundError で落ちること", async () => {
      const deps = makeDeps();

      const result = await getUserQuery(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe(
        "ResourceNotFoundError",
      );
    });

    test("引き当てに失敗した場合、その失敗をそのまま返すこと", async () => {
      // DB の失敗を「居ない = 404」に畳むと、原因が消える。
      const deps = makeDeps({
        getUserQueryService: {
          execute: async () =>
            Result.err(
              new RepositoryError({ failure: "unavailable", cause: "db down" }),
            ),
        },
      });

      const result = await getUserQuery(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe("RepositoryError");
    });
  });
});
