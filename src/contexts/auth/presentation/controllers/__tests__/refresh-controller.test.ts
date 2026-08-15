import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import {
  cookieValueOf,
  FAKE_ACCESS_TOKEN,
  FAKE_REFRESH_TOKEN,
  FAKE_TOKEN_HASH,
  FIXED_NOW,
  FIXED_UUID,
  headers,
  OTHER_UUID,
  REFRESH_COOKIE_NAME,
  setCookieOf,
  withRefreshCookie,
} from "~/__mocks__/data";
import { app } from "~/app";
import type { AppDeps } from "~/app-deps";
import {
  type RefreshToken,
  RevokedReasonEnum,
} from "~/contexts/auth/domain/model/refresh-token";
import { RefreshTokenHash } from "~/contexts/auth/domain/model/value-objects/refresh-token-hash";
import { ErrorCode } from "~/shared/presentation/constants/error-code";
import { ErrorTitle } from "~/shared/presentation/constants/error-title";
import { HttpStatus } from "~/shared/presentation/constants/http-status";

import { refreshController } from "../refresh-controller";

/** 差し替え後の券。提示した券と区別できるよう別の値にする。 */
const NEXT_REFRESH_TOKEN = "rt_next-refresh-token-after-rotation-0123456789";
const NEXT_TOKEN_HASH = RefreshTokenHash.parse("1".repeat(64));

/** 券は **Cookie で送る**。ボディは空 (ブラウザが自動で付ける)。 */
const refresh = async (
  deps: AppDeps,
  refreshToken: string = FAKE_REFRESH_TOKEN,
): Promise<Response> =>
  await app(deps).request("/auth/refresh", {
    method: "POST",
    headers: withRefreshCookie(refreshToken),
  });

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

type Rotated = {
  readonly revoked: RefreshToken;
  readonly issued: RefreshToken;
};
type Revoked = { readonly sessionId: string; readonly revokedAt: Date };

const recording = (
  stored?: RefreshToken,
): {
  readonly deps: AppDeps;
  readonly rotated: Rotated[];
  readonly revoked: Revoked[];
} => {
  const rotated: Rotated[] = [];
  const revoked: Revoked[] = [];
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

const secondsBefore = (seconds: number): Date =>
  new Date(FIXED_NOW.getTime() - seconds * 1000);

describe(refreshController.name, () => {
  describe("正常系", () => {
    test("使える券なら 200。本文は accessToken だけで、券は Cookie で差し替わること", async () => {
      const stored = makeStored();
      const { deps, rotated } = recording(stored);

      const response = await refresh(deps);

      expect(response.status).toBe(HttpStatus.Ok);
      expect(await response.json()).toStrictEqual({
        accessToken: FAKE_ACCESS_TOKEN,
      });

      // 返るのは**差し替え後**の券。提示した券を返すと失効済みを持ち続ける。
      expect(cookieValueOf(response)).toBe(NEXT_REFRESH_TOKEN);
      const setCookie = setCookieOf(response) ?? "";
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("Path=/auth/refresh");
      expect(setCookie).toContain(`Max-Age=${14 * 24 * 60 * 60}`);

      expect(rotated).toHaveLength(1);
      expect(rotated[0]?.revoked.id).toBe(stored.id);
      // 理由は rotated。revoked にすると猶予が効かず並行更新が盗難扱いされる。
      expect(rotated[0]?.revoked.revokedReason).toBe(RevokedReasonEnum.Rotated);
      expect(rotated[0]?.issued.tokenHash).toBe(NEXT_TOKEN_HASH);
      // **セッションは据え置く。**
      expect(rotated[0]?.issued.sessionId).toBe(stored.sessionId);
      expect(rotated[0]?.issued.userId).toBe(stored.userId);
    });

    test("ローテーション済みでも猶予の内なら締め出さないこと", async () => {
      const { deps, rotated } = recording(
        makeStored({
          revokedAt: secondsBefore(5),
          revokedReason: RevokedReasonEnum.Rotated,
        }),
      );

      const response = await refresh(deps);

      // 並行更新は正規の利用者の姿。締め出さないのが正解。
      expect(response.status).toBe(HttpStatus.Ok);
      expect(cookieValueOf(response)).toBe(NEXT_REFRESH_TOKEN);
      expect(rotated).toHaveLength(1);
    });
  });

  describe("異常系", () => {
    test("猶予の外で再利用されたら 401。セッションごと切ること", async () => {
      const stored = makeStored({
        revokedAt: secondsBefore(60),
        revokedReason: RevokedReasonEnum.Rotated,
      });
      const { deps, rotated, revoked } = recording(stored);

      const response = await refresh(deps);

      expect(response.status).toBe(HttpStatus.Unauthorized);
      // 盗難のサイン。**差し替えずに**セッションを落とす。
      expect(rotated).toStrictEqual([]);
      expect(revoked).toStrictEqual([
        { sessionId: stored.sessionId, revokedAt: expect.any(Date) },
      ]);
    });

    test("既に切られた券は 401。切り直しもしないこと", async () => {
      const { deps, rotated, revoked } = recording(
        makeStored({
          revokedAt: secondsBefore(5),
          revokedReason: RevokedReasonEnum.Revoked,
        }),
      );

      const response = await refresh(deps);

      // 猶予の内 (5 秒前) でも通してはいけない — 通すとセッションが生き返る。
      expect(response.status).toBe(HttpStatus.Unauthorized);
      expect(rotated).toStrictEqual([]);
      expect(revoked).toStrictEqual([]);
    });

    test("期限切れは 401。差し替えも失効も走らないこと", async () => {
      const { deps, rotated, revoked } = recording(
        makeStored({ expiresAt: secondsBefore(1) }),
      );

      const response = await refresh(deps);

      expect(response.status).toBe(HttpStatus.Unauthorized);
      expect(rotated).toStrictEqual([]);
      expect(revoked).toStrictEqual([]);
    });

    test("401 になる理由が違っても本文を書き分けないこと", async () => {
      const cases = [
        recording().deps,
        recording(makeStored({ expiresAt: secondsBefore(1) })).deps,
        recording(
          makeStored({
            revokedAt: secondsBefore(5),
            revokedReason: RevokedReasonEnum.Revoked,
          }),
        ).deps,
      ];

      const bodies = await Promise.all(
        cases.map(async (deps) => await (await refresh(deps)).json()),
      );

      // 書き分けると「その券は存在する」と攻撃側に教えることになる。
      expect(bodies[0]).toStrictEqual(bodies[1]);
      expect(bodies[1]).toStrictEqual(bodies[2]);
      expect(bodies[0]).toStrictEqual({
        status: HttpStatus.Unauthorized,
        code: ErrorCode.Unauthorized,
        title: ErrorTitle.Unauthorized,
      });
    });

    test("契約に反する券は 400 と該当フィールドを返すこと", async () => {
      const response = await refresh(makeDeps(), "short");

      expect(response.status).toBe(HttpStatus.BadRequest);
      expect(await response.json()).toStrictEqual({
        status: HttpStatus.BadRequest,
        code: ErrorCode.BadRequest,
        title: ErrorTitle.BadRequest,
        // フィールド名は Cookie の名前そのもの (ボディの項目名ではない)。
        errors: [{ field: REFRESH_COOKIE_NAME, message: expect.any(String) }],
      });
    });

    test("Cookie が無ければ 400", async () => {
      // 「券が無い」は形式の話なので 400。401 にすると認証の失敗と区別がつかない。
      const response = await app(makeDeps()).request("/auth/refresh", {
        method: "POST",
        headers,
      });

      expect(response.status).toBe(HttpStatus.BadRequest);
      expect(setCookieOf(response)).toBeNull();
    });
  });
});
