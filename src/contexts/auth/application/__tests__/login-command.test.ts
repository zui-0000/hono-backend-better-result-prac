import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import {
  FAKE_ACCESS_TOKEN,
  FAKE_REFRESH_TOKEN,
  FAKE_TOKEN_HASH,
  FIXED_UUID,
  OTHER_UUID,
} from "~/__mocks__/data";
import type { RefreshToken } from "~/contexts/auth/domain/model/refresh-token";
import { RefreshTokenHash } from "~/contexts/auth/domain/model/value-objects/refresh-token-hash";
import { SessionId } from "~/contexts/auth/domain/model/value-objects/session-id";
import { UserId } from "~/contexts/user/domain/model/value-objects/user-id";
import type { AccessTokenClaims } from "~/shared/domain/model/access-token-claims";
import { RepositoryError } from "~/shared/errors/repository-error";

import { loginCommand } from "../login-command";

const VALID = {
  mailAddress: "existing@example.com",
  password: "password1234",
};

/** 照合が通る依存。既定は「誰も居ない」なので、通す側を明示的に組む。 */
const identified = (): ReturnType<typeof makeDeps> =>
  makeDeps({
    verifyCredentialsQueryService: {
      execute: async () => Result.ok(UserId.parse(OTHER_UUID)),
    },
  });

describe(loginCommand.name, () => {
  describe("正常系", () => {
    test("照合できた場合、アクセストークンと券を返すこと", async () => {
      const deps = identified();

      const result = await loginCommand(deps)(VALID);

      expect(result.isOk() ? result.value : null).toStrictEqual({
        accessToken: FAKE_ACCESS_TOKEN,
        refreshToken: FAKE_REFRESH_TOKEN,
      });
    });

    test("照合できた場合、券は平文ではなくハッシュを保存すること", async () => {
      // **平文を保存すると、DB が漏れた時点でそのまま使える券が漏れる。**
      // 返すのは平文、保存するのはハッシュ、という非対称がここで守られている。
      const created: RefreshToken[] = [];
      const deps = makeDeps({
        verifyCredentialsQueryService: {
          execute: async () => Result.ok(UserId.parse(OTHER_UUID)),
        },
        refreshTokenRepository: {
          create: async (token) => {
            created.push(token);
            return Result.ok();
          },
        },
      });

      const result = await loginCommand(deps)(VALID);

      expect(created[0]?.tokenHash).toBe(
        RefreshTokenHash.parse(FAKE_TOKEN_HASH),
      );
      expect(result.isOk() ? result.value.refreshToken : null).toBe(
        FAKE_REFRESH_TOKEN,
      );
    });

    test("照合できた場合、セッションを新しく採番すること", async () => {
      // **refresh との違いがここ。** 更新は据え置き、ログインは採番する。
      // 据え置くと、ログインのたびに古いセッションが復活する。
      const created: RefreshToken[] = [];
      const deps = makeDeps({
        verifyCredentialsQueryService: {
          execute: async () => Result.ok(UserId.parse(OTHER_UUID)),
        },
        refreshTokenRepository: {
          create: async (token) => {
            created.push(token);
            return Result.ok();
          },
        },
      });

      await loginCommand(deps)(VALID);

      expect(created[0]?.sessionId).toBe(SessionId.parse(FIXED_UUID));
      expect(created[0]?.userId).toBe(UserId.parse(OTHER_UUID));
    });

    test("照合できた場合、アクセストークンに利用者とセッションを載せること", async () => {
      // sid にセッションを載せるので、ログアウトがこの単位で効く。
      // 券 1 枚の id を載せると、古いタブからのログアウトが空振りする。
      const claims: AccessTokenClaims[] = [];
      const deps = makeDeps({
        verifyCredentialsQueryService: {
          execute: async () => Result.ok(UserId.parse(OTHER_UUID)),
        },
        accessTokenIssuer: {
          issue: async (received) => {
            claims.push(received);
            return FAKE_ACCESS_TOKEN;
          },
        },
      });

      await loginCommand(deps)(VALID);

      expect(claims).toStrictEqual([{ sub: OTHER_UUID, sid: FIXED_UUID }]);
    });
  });

  describe("異常系", () => {
    test("照合できない場合、UnauthorizedError で落ちること", async () => {
      const deps = makeDeps();

      const result = await loginCommand(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe(
        "UnauthorizedError",
      );
    });

    test("照合できない場合、券を作らないこと", async () => {
      const created: RefreshToken[] = [];
      const deps = makeDeps({
        refreshTokenRepository: {
          create: async (token) => {
            created.push(token);
            return Result.ok();
          },
        },
      });

      await loginCommand(deps)(VALID);

      expect(created).toStrictEqual([]);
    });

    test("券の保存に失敗した場合、その失敗をそのまま返すこと", async () => {
      // 保存できていないのに 200 を返すと、次の更新で必ず 401 になる。
      const deps = makeDeps({
        verifyCredentialsQueryService: {
          execute: async () => Result.ok(UserId.parse(OTHER_UUID)),
        },
        refreshTokenRepository: {
          create: async () =>
            Result.err(
              new RepositoryError({ failure: "unavailable", cause: "db down" }),
            ),
        },
      });

      const result = await loginCommand(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe("RepositoryError");
    });
  });

  describe("入力の変換", () => {
    test("契約を満たさない入力の場合、失敗ではなく throw すること", async () => {
      // 契約とドメインの制約は一致しているので、ここで落ちるのは**サーバのバグ**。
      const command = loginCommand(identified());

      await expect(command({ ...VALID, password: "short" })).rejects.toThrow();
    });
  });
});
