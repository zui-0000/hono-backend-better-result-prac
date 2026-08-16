import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import { FIXED_NOW, OTHER_UUID } from "~/__mocks__/data";
import { RepositoryError } from "~/shared/errors/repository-error";

import { logoutCommand } from "../logout-command";

const VALID = { sessionId: OTHER_UUID };

describe(logoutCommand.name, () => {
  describe("正常系", () => {
    test("セッション単位で失効させること", async () => {
      // **切る単位は sessionId であって userId ではない。** sub で切ると、
      // スマホでログアウトしたら PC まで落ちる。
      const revoked: unknown[] = [];
      const deps = makeDeps({
        refreshTokenRepository: {
          revokeSession: async (params) => {
            revoked.push(params);
            return Result.ok();
          },
        },
      });

      const result = await logoutCommand(deps)(VALID);

      expect(result.isOk()).toBe(true);
      expect(revoked).toStrictEqual([
        { sessionId: OTHER_UUID, revokedAt: FIXED_NOW },
      ]);
    });

    test("失効時刻を Clock から取ること", async () => {
      // DB の now() に任せると、テストで時刻を固定できず、
      // アプリとDBの時計がずれたときに猶予期間の判定が狂う。
      const revoked: { readonly revokedAt: Date }[] = [];
      const deps = makeDeps({
        refreshTokenRepository: {
          revokeSession: async (params) => {
            revoked.push(params);
            return Result.ok();
          },
        },
      });

      await logoutCommand(deps)(VALID);

      expect(revoked[0]?.revokedAt).toStrictEqual(FIXED_NOW);
    });
  });

  describe("異常系", () => {
    test("失効に失敗した場合、その失敗をそのまま返すこと", async () => {
      const deps = makeDeps({
        refreshTokenRepository: {
          revokeSession: async () =>
            Result.err(
              new RepositoryError({ failure: "unavailable", cause: "db down" }),
            ),
        },
      });

      const result = await logoutCommand(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe("RepositoryError");
    });
  });

  describe("入力の変換", () => {
    test("sessionId が uuid v7 でない場合、失敗ではなく throw すること", async () => {
      // claims は AuthenticatedCaller が検証済み。ここで落ちるのは
      // 検証を抜けた値が届いたということで、**サーバのバグ**。
      const command = logoutCommand(makeDeps());

      await expect(command({ sessionId: "not-a-uuid" })).rejects.toThrow();
    });
  });
});
