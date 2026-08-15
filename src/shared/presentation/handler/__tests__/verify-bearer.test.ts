import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import { FAKE_ACCESS_TOKEN, REQUEST_ID } from "~/__mocks__/data";
import { createApp } from "~/app";
import { UnauthorizedError } from "~/shared/errors/unauthorized-error";
import { ErrorCode } from "~/shared/presentation/constants/error-code";
import { HttpHeader } from "~/shared/presentation/constants/http-header";
import { HttpStatus } from "~/shared/presentation/constants/http-status";

import { verifyBearer } from "../verify-bearer";

const AUTHED_PATH = "/users/019fa5bc-0000-7000-8000-000000000000";

const get = async (
  authorization?: string,
  deps = makeDeps(),
): Promise<Response> =>
  await createApp(deps).request(AUTHED_PATH, {
    headers: {
      [HttpHeader.RequestId]: REQUEST_ID,
      ...(authorization === undefined
        ? {}
        : { [HttpHeader.Authorization]: authorization }),
    },
  });

describe(verifyBearer.name, () => {
  test("Bearer が無ければ 401", async () => {
    expect((await get()).status).toBe(HttpStatus.Unauthorized);
  });

  test("Bearer 形式でなければ 401", async () => {
    expect((await get(FAKE_ACCESS_TOKEN)).status).toBe(HttpStatus.Unauthorized);
  });

  test("検証に失敗すれば 401。理由は本文に出さないこと", async () => {
    const deps = makeDeps({
      accessTokenIssuer: {
        verify: async () => Result.err(new UnauthorizedError()),
      },
    });

    const response = await get(`Bearer ${FAKE_ACCESS_TOKEN}`, deps);

    expect(response.status).toBe(HttpStatus.Unauthorized);
    // 期限切れ・署名不正・形式不正を書き分けない (攻撃側に手掛かりを与えない)。
    expect(((await response.json()) as { code: string }).code).toBe(
      ErrorCode.Unauthorized,
    );
  });

  test("認証は契約検証より先に走ること", async () => {
    // 通っていない相手には契約の話を一切しない (400 の errors は
    // フィールド名と制約をそのまま返すため)。
    const response = await createApp(makeDeps()).request("/users/not-a-uuid", {
      headers: { [HttpHeader.RequestId]: REQUEST_ID },
    });

    expect(response.status).toBe(HttpStatus.Unauthorized);
  });
});
