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
  setCookieOf,
  withRefreshCookie,
} from "~/__mocks__/data";
import { app } from "~/app";
import type { AppDeps } from "~/app-deps";
import {
  REFRESH_TOKEN_TTL_MILLIS,
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

/** Cookie を付けずに送る (ログアウト済み / Cookie が消えた状況)。 */
const refreshWithoutCookie = async (deps: AppDeps): Promise<Response> =>
  await app(deps).request("/auth/refresh", { method: "POST", headers });

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
    test("使える券の場合、200 を返し本文は accessToken だけで券は Cookie で差し替わること", async () => {
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
      // **domain の寿命から導く。** 境界ルールで実装側は直接 import できないので
      // (presentation-not-to-context-domain)、両者が揃っていることをここで固定する。
      // 片方だけ変えると落ちる — 揃っていないと「なぜかログアウトされる」が起きる。
      expect(setCookie).toContain(`Max-Age=${REFRESH_TOKEN_TTL_MILLIS / 1000}`);

      expect(rotated).toHaveLength(1);
      expect(rotated[0]?.revoked.id).toBe(stored.id);
      // 理由は rotated。revoked にすると猶予が効かず並行更新が盗難扱いされる。
      expect(rotated[0]?.revoked.revokedReason).toBe(RevokedReasonEnum.Rotated);
      expect(rotated[0]?.issued.tokenHash).toBe(NEXT_TOKEN_HASH);
      // **セッションは据え置く。**
      expect(rotated[0]?.issued.sessionId).toBe(stored.sessionId);
      expect(rotated[0]?.issued.userId).toBe(stored.userId);
    });

    test("ローテーション済みでも猶予の内の場合、締め出さないこと", async () => {
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
    test("猶予の外で再利用された場合、401 を返しセッションごと切ること", async () => {
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

    test("既に切られた券の場合、401 を返し切り直しもしないこと", async () => {
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

    test("期限切れの場合、401 を返し差し替えも失効も走らないこと", async () => {
      const { deps, rotated, revoked } = recording(
        makeStored({ expiresAt: secondsBefore(1) }),
      );

      const response = await refresh(deps);

      expect(response.status).toBe(HttpStatus.Unauthorized);
      expect(rotated).toStrictEqual([]);
      expect(revoked).toStrictEqual([]);
    });

    test("失敗の理由が違う場合でも、応答が 1 種類しか無いこと", async () => {
      const send = [
        // 知らない券
        async () => await refresh(recording().deps),
        // 期限切れ
        async () =>
          await refresh(
            recording(makeStored({ expiresAt: secondsBefore(1) })).deps,
          ),
        // 失効済み
        async () =>
          await refresh(
            recording(
              makeStored({
                revokedAt: secondsBefore(5),
                revokedReason: RevokedReasonEnum.Revoked,
              }),
            ).deps,
          ),
        // 契約の @minLength(20) に満たない券。**形式の違反も 401 に倒す。**
        async () => await refresh(makeDeps(), "short"),
        // Cookie そのものが無い (ログアウト済み / Cookie が消えた)。
        // **使える券が保存されている deps** を渡す — makeDeps() だと引き当てに
        // 失敗して 401 になり、「見に行かずに断った」のか区別がつかない。
        async () => await refreshWithoutCookie(recording(makeStored()).deps),
      ];

      const responses = await Promise.all(send.map(async (f) => await f()));

      // 書き分けると「その券は存在する」と攻撃側に教えることになる。
      // **形式の違反と「券が無い」も同じ応答に畳む** — 呼ぶ側にとってはどれも
      // 「認証をやり直せ」でしかなく、400 と 401 に割れると再ログインの判定を
      // 2 通り書くことになる (実測で踏んだ)。
      for (const response of responses) {
        expect(response.status).toBe(HttpStatus.Unauthorized);
        expect(await response.json()).toStrictEqual({
          status: HttpStatus.Unauthorized,
          code: ErrorCode.Unauthorized,
          title: ErrorTitle.Unauthorized,
        });
      }
    });

    test("Cookie が無い場合、使える券が保存されていても 401 で打ち切ること", async () => {
      // 保存側は「常に使える券を返す」ので、**引きに行けば 200 になってしまう**。
      // それでも 401 で終わることが「Cookie が無い時点で打ち切っている」証拠になる。
      const { deps, rotated, revoked } = recording(makeStored());

      const response = await refreshWithoutCookie(deps);

      expect(response.status).toBe(HttpStatus.Unauthorized);
      expect(setCookieOf(response)).toBeNull();
      expect(rotated).toStrictEqual([]);
      expect(revoked).toStrictEqual([]);
    });
  });
});
