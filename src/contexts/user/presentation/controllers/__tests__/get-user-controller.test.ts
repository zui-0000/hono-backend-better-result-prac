import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import { FIXED_UUID, headers, OTHER_UUID } from "~/__mocks__/data";
import { app } from "~/app";
import type { AppDeps } from "~/app-deps";
import { ErrorCode } from "~/shared/presentation/constants/error-code";
import { HttpStatus } from "~/shared/presentation/constants/http-status";

import { getUserController } from "../get-user-controller";

const get = async (deps: AppDeps, id: string = FIXED_UUID): Promise<Response> =>
  await app(deps).request(`/users/${id}`, { headers });

describe(getUserController.name, () => {
  test("本人の場合、200 と射影を返すこと", async () => {
    const deps = makeDeps({
      getUserQueryService: {
        execute: async () =>
          Result.ok({ name: "既存ユーザー", mailAddress: "a@example.com" }),
      },
    });

    const response = await get(deps);

    expect(response.status).toBe(HttpStatus.Ok);
    // 射影に id もパスワードも含まれないこと (契約どおりの形)。
    expect(await response.json()).toStrictEqual({
      name: "既存ユーザー",
      mailAddress: "a@example.com",
    });
  });

  test("他人の id の場合、403 を返し、DB を引かずに落ちること", async () => {
    let queried = 0;
    const deps = makeDeps({
      getUserQueryService: {
        execute: async () => {
          queried += 1;
          return Result.ok({ name: "他人", mailAddress: "b@example.com" });
        },
      },
    });

    const response = await get(deps, OTHER_UUID);

    expect(response.status).toBe(HttpStatus.Forbidden);
    // 認可の失敗は対象の有無に関わらず 403。だから引く前に落ちる。
    expect(queried).toBe(0);
  });

  test("存在しない場合、404 を返すこと", async () => {
    const response = await get(makeDeps());

    expect(response.status).toBe(HttpStatus.NotFound);
    expect(((await response.json()) as { code: string }).code).toBe(
      ErrorCode.ResourceNotFound,
    );
  });

  test("id が uuid でない場合、400 を返すこと", async () => {
    const response = await get(makeDeps(), "not-a-uuid");

    expect(response.status).toBe(HttpStatus.BadRequest);
  });
});
