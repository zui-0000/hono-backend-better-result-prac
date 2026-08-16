import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import {
  cookieValueOf,
  FAKE_CALLER,
  headers,
  REQUEST_ID,
  setCookieOf,
} from "~/__mocks__/data";
import { app } from "~/app";
import type { AppDeps } from "~/app-deps";
import { HttpHeader } from "~/shared/presentation/constants/http-header";
import { HttpStatus } from "~/shared/presentation/constants/http-status";

import { logoutController } from "../logout-controller";

type Revoked = { readonly sessionId: string; readonly revokedAt: Date };

const recording = (): {
  readonly deps: AppDeps;
  readonly revoked: Revoked[];
} => {
  const revoked: Revoked[] = [];
  return {
    revoked,
    deps: makeDeps({
      refreshTokenRepository: {
        revokeSession: async (params) => {
          revoked.push(params);
          return Result.ok();
        },
      },
    }),
  };
};

const logout = async (
  deps: AppDeps,
  requestHeaders: Record<string, string> = headers,
): Promise<Response> =>
  await app(deps).request("/auth/logout", {
    method: "POST",
    headers: requestHeaders,
  });

describe(logoutController.name, () => {
  test("204 を返し、その sid でセッションを切ること", async () => {
    const { deps, revoked } = recording();

    const response = await logout(deps);

    expect(response.status).toBe(HttpStatus.NoContent);
    expect(await response.text()).toBe("");
    // **切る単位はセッション (sid) であって利用者 (sub) ではない。**
    expect(revoked).toStrictEqual([
      { sessionId: FAKE_CALLER.sessionId, revokedAt: expect.any(Date) },
    ]);
    expect(revoked[0]?.sessionId).not.toBe(FAKE_CALLER.userId);
  });

  test("Cookie も消すこと (サーバ側の失効だけでは足りない)", async () => {
    const { deps } = recording();

    const response = await logout(deps);

    // 消さないとブラウザは 2 週間送り続け、盗難検出のログをノイズで埋める。
    expect(cookieValueOf(response)).toBe("");
    const setCookie = setCookieOf(response) ?? "";
    expect(setCookie).toContain("Max-Age=0");
    // **属性は発行時と揃っていること。** 1 つでも違うと消したつもりで残る。
    expect(setCookie).toContain("Path=/auth/refresh");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });

  test("204 なのに本文が生えないこと (Cookie を載せても)", async () => {
    const { deps } = recording();

    const response = await logout(deps);

    expect(response.status).toBe(HttpStatus.NoContent);
    expect(await response.text()).toBe("");
    expect(response.headers.get("content-type")).toBeNull();
  });

  test("Bearer が無ければ 401。失効も走らないこと", async () => {
    const { deps, revoked } = recording();

    const response = await logout(deps, {
      "Content-Type": "application/json",
      [HttpHeader.RequestId]: REQUEST_ID,
    });

    expect(response.status).toBe(HttpStatus.Unauthorized);
    expect(revoked).toStrictEqual([]);
  });
});
