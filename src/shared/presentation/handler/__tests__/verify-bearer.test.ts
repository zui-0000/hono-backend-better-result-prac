import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import { FAKE_ACCESS_TOKEN, REQUEST_ID } from "~/__mocks__/data";
import { app } from "~/app";
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
  await app(deps).request(AUTHED_PATH, {
    headers: {
      [HttpHeader.RequestId]: REQUEST_ID,
      ...(authorization === undefined
        ? {}
        : { [HttpHeader.Authorization]: authorization }),
    },
  });

describe(verifyBearer.name, () => {
  test("Bearer が無い場合、401 を返すこと", async () => {
    expect((await get()).status).toBe(HttpStatus.Unauthorized);
  });

  test("Bearer 形式でない場合、401 を返すこと", async () => {
    expect((await get(FAKE_ACCESS_TOKEN)).status).toBe(HttpStatus.Unauthorized);
  });

  test("検証に失敗した場合、401 を返し理由は本文に出さないこと", async () => {
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

  test("認証と契約検証の両方が失敗する場合、認証を先に走らせること", async () => {
    // 通っていない相手には契約の話を一切しない (400 の errors は
    // フィールド名と制約をそのまま返すため)。
    const response = await app(makeDeps()).request("/users/not-a-uuid", {
      headers: { [HttpHeader.RequestId]: REQUEST_ID },
    });

    expect(response.status).toBe(HttpStatus.Unauthorized);
  });
});
