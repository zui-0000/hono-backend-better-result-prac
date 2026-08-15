import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import {
  FAKE_ACCESS_TOKEN,
  FAKE_REFRESH_TOKEN,
  FAKE_TOKEN_HASH,
  FIXED_NOW,
  FIXED_UUID,
  OTHER_UUID,
} from "~/__mocks__/data";
import {
  type RefreshToken,
  RevokedReasonEnum,
} from "~/contexts/auth/domain/model/refresh-token";
import { RefreshTokenHash } from "~/contexts/auth/domain/model/value-objects/refresh-token-hash";
import { RepositoryError } from "~/shared/errors/repository-error";

import { refreshCommand } from "../refresh-command";

const VALID = { refreshToken: FAKE_REFRESH_TOKEN };

/** 差し替え後の券。提示した券と区別できるよう別の値にする。 */
const NEXT_REFRESH_TOKEN = "rt_next-refresh-token-after-rotation-0123456789";
const NEXT_TOKEN_HASH = RefreshTokenHash.parse("1".repeat(64));

const makeStored = (over: Partial<RefreshToken> = {}): RefreshToken =>
  ({
    id: "019fde14-54da-7000-85b3-d7e794ca99f6",
    sessionId: OTHER_UUID,
    tokenHash: FAKE_TOKEN_HASH,
    userId: FIXED_UUID,
    expiresAt: new Date(FIXED_NOW.getTime() + 60_000),
    revokedAt: null,
    revokedReason: null,
    createdAt: FIXED_NOW,
    ...over,
  }) as RefreshToken;

const secondsBefore = (seconds: number): Date =>
  new Date(FIXED_NOW.getTime() - seconds * 1000);

type Rotated = {
  readonly revoked: RefreshToken;
  readonly issued: RefreshToken;
};

/**
 * 保存済みの券を差し替えた依存。
 *
 * `stored` は省略できる形にしてある (既定値を置くと、`undefined` を渡して
 * 「知らない券」を試したつもりが「居る」で走ってしまう)。
 */
const recording = (
  stored?: RefreshToken,
): {
  readonly deps: ReturnType<typeof makeDeps>;
  readonly rotated: Rotated[];
  readonly revoked: unknown[];
} => {
  const rotated: Rotated[] = [];
  const revoked: unknown[] = [];
  return {
    rotated,
    revoked,
    deps: makeDeps({
      refreshTokenRepository: {
        findByTokenHash: async () => Result.ok(stored),
        rotate: async (params) => {
          rotated.push(params);
          return Result.ok();
        },
        revokeSession: async (params) => {
          revoked.push(params);
          return Result.ok();
        },
      },
      refreshTokenIssuer: {
        issue: async () => ({
          token: NEXT_REFRESH_TOKEN,
          hash: NEXT_TOKEN_HASH,
        }),
      },
    }),
  };
};

describe(refreshCommand.name, () => {
  describe("正常系", () => {
    test("使える券の場合、差し替えて新しい組を返すこと", async () => {
      const stored = makeStored();
      const { deps, rotated } = recording(stored);

      const result = await refreshCommand(deps)(VALID);

      expect(result.isOk() ? result.value : null).toStrictEqual({
        accessToken: FAKE_ACCESS_TOKEN,
        // 返すのは**差し替え後**の券。提示した券を返すと失効済みを持ち続ける。
        refreshToken: NEXT_REFRESH_TOKEN,
      });
      expect(rotated).toHaveLength(1);
      expect(rotated[0]?.revoked.id).toBe(stored.id);
      // 理由は rotated。revoked にすると猶予が効かず並行更新が盗難扱いされる。
      expect(rotated[0]?.revoked.revokedReason).toBe(RevokedReasonEnum.Rotated);
      expect(rotated[0]?.issued.tokenHash).toBe(NEXT_TOKEN_HASH);
    });

    test("使える券の場合、セッションを据え置くこと", async () => {
      // **login との違いがここ。** 採番し直すと更新のたびにログアウトの単位が変わり、
      // 古いタブからのログアウトが空振りする。
      const stored = makeStored();
      const { deps, rotated } = recording(stored);

      await refreshCommand(deps)(VALID);

      expect(rotated[0]?.issued.sessionId).toBe(stored.sessionId);
      expect(rotated[0]?.issued.userId).toBe(stored.userId);
    });

    test("ローテーション済みでも猶予の内の場合、差し替えること", async () => {
      // 並行更新したタブは正規の利用者の姿。締め出さないのが正解。
      const { deps, rotated } = recording(
        makeStored({
          revokedAt: secondsBefore(5),
          revokedReason: RevokedReasonEnum.Rotated,
        }),
      );

      const result = await refreshCommand(deps)(VALID);

      expect(result.isOk()).toBe(true);
      expect(rotated).toHaveLength(1);
    });

    test("提示された券は、ハッシュに直してから引くこと", async () => {
      // **券そのものは保存していない。** 平文で引こうとすると必ず空振りする。
      const hashed: string[] = [];
      const looked: string[] = [];
      const deps = makeDeps({
        refreshTokenIssuer: {
          hash: async (token) => {
            hashed.push(token);
            return RefreshTokenHash.parse(FAKE_TOKEN_HASH);
          },
        },
        refreshTokenRepository: {
          findByTokenHash: async (tokenHash) => {
            looked.push(tokenHash);
            return Result.ok(makeStored());
          },
        },
      });

      await refreshCommand(deps)(VALID);

      expect(hashed).toStrictEqual([FAKE_REFRESH_TOKEN]);
      expect(looked).toStrictEqual([FAKE_TOKEN_HASH]);
    });
  });

  describe("異常系", () => {
    test("知らない券の場合、UnauthorizedError で落ちること", async () => {
      const { deps, rotated, revoked } = recording();

      const result = await refreshCommand(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe(
        "UnauthorizedError",
      );
      expect(rotated).toStrictEqual([]);
      expect(revoked).toStrictEqual([]);
    });

    test("猶予の外で再利用された場合、そのセッションを切って落とすこと", async () => {
      // 盗難のサイン。**差し替えずに**セッションを落とす。
      // 誤検出も起こりうるので、全端末ではなくそのセッションだけ。
      const stored = makeStored({
        revokedAt: secondsBefore(60),
        revokedReason: RevokedReasonEnum.Rotated,
      });
      const { deps, rotated, revoked } = recording(stored);

      const result = await refreshCommand(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe(
        "UnauthorizedError",
      );
      expect(rotated).toStrictEqual([]);
      expect(revoked).toStrictEqual([
        { sessionId: stored.sessionId, revokedAt: FIXED_NOW },
      ]);
    });

    test("既に切られた券の場合、切り直しもしないこと", async () => {
      // 猶予の内 (5 秒前) でも通してはいけない — 通すとセッションが生き返る。
      const { deps, rotated, revoked } = recording(
        makeStored({
          revokedAt: secondsBefore(5),
          revokedReason: RevokedReasonEnum.Revoked,
        }),
      );

      const result = await refreshCommand(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe(
        "UnauthorizedError",
      );
      expect(rotated).toStrictEqual([]);
      expect(revoked).toStrictEqual([]);
    });

    test("期限切れの場合、差し替えも失効も走らないこと", async () => {
      const { deps, rotated, revoked } = recording(
        makeStored({ expiresAt: secondsBefore(1) }),
      );

      const result = await refreshCommand(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe(
        "UnauthorizedError",
      );
      expect(rotated).toStrictEqual([]);
      expect(revoked).toStrictEqual([]);
    });

    test("差し替えに失敗した場合、その失敗をそのまま返すこと", async () => {
      // 失効と発行は 1 つの単位。間で落ちるとクライアントは再ログインしか道が無くなる。
      const deps = makeDeps({
        refreshTokenRepository: {
          findByTokenHash: async () => Result.ok(makeStored()),
          rotate: async () =>
            Result.err(
              new RepositoryError({ failure: "contention", cause: "deadlock" }),
            ),
        },
      });

      const result = await refreshCommand(deps)(VALID);

      expect(result.isOk() ? null : result.error._tag).toBe("RepositoryError");
    });
  });
});
