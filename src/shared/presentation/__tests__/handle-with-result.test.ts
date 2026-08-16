import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import { FIXED_UUID, headers, makeUser, REQUEST_ID } from "~/__mocks__/data";
import { app } from "~/app";
import { ErrorCode } from "~/shared/presentation/constants/error-code";
import { ErrorTitle } from "~/shared/presentation/constants/error-title";
import { HttpHeader } from "~/shared/presentation/constants/http-header";
import { HttpStatus } from "~/shared/presentation/constants/http-status";

import { handleWithResult } from "../handle-with-result";

describe(handleWithResult.name, () => {
  test("throw された場合でも、契約どおりの 500 と相関 ID を返すこと", async () => {
    // 放っておくと Hono 既定の平文 500 が返り、契約と違う形になったうえ
    // ログも残らない。**この受け皿 1 つで全 throw を覆う。**
    const deps = makeDeps({
      getUserQueryService: {
        execute: async () => {
          throw new Error("想定外の失敗");
        },
      },
    });

    const response = await app(deps).request(`/users/${FIXED_UUID}`, {
      headers,
    });

    expect(response.status).toBe(HttpStatus.InternalServerError);
    expect(await response.json()).toStrictEqual({
      status: HttpStatus.InternalServerError,
      code: ErrorCode.InternalServerError,
      title: ErrorTitle.InternalServerError,
    });
    expect(response.headers.get(HttpHeader.RequestId)).toBe(REQUEST_ID);
  });

  test("応答が契約とズレた場合、500 になること (握り潰さない)", async () => {
    // クエリ側はドメインを経由しないので、ここが唯一の関所。
    const deps = makeDeps({
      getUserQueryService: {
        // **本物の Result で返すこと。** 偽のオブジェクトだと yield* の時点で
        // 壊れ、応答検証まで到達しないまま 500 になる (それでもテストは緑になる)。
        execute: async () =>
          // 契約に無い形 (name が欠けている)
          Result.ok({ mailAddress: "a@example.com" } as never),
      },
    });

    const response = await app(deps).request(`/users/${FIXED_UUID}`, {
      headers,
    });

    expect(response.status).toBe(HttpStatus.InternalServerError);
  });

  test("204 の場合、本文も Content-Type も付かないこと", async () => {
    const deps = makeDeps({
      userRepository: {
        findById: async () => Result.ok(makeUser()),
      },
    });

    const response = await app(deps).request(`/users/${FIXED_UUID}`, {
      method: "DELETE",
      headers,
    });

    expect(response.status).toBe(HttpStatus.NoContent);
    expect(await response.text()).toBe("");
    expect(response.headers.get("content-type")).toBeNull();
  });
});
