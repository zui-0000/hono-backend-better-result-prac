import { describe, expect, test } from "bun:test";

import { makeDeps } from "~/__mocks__/app-deps";
import { headers, REQUEST_ID } from "~/__mocks__/data";
import { app } from "~/app";
import { ErrorCode } from "~/shared/presentation/constants/error-code";
import { ErrorTitle } from "~/shared/presentation/constants/error-title";
import { HttpHeader } from "~/shared/presentation/constants/http-header";
import { HttpStatus } from "~/shared/presentation/constants/http-status";

import { handleNotFound } from "../handle-not-found";

describe(handleNotFound.name, () => {
  test("未知の経路の場合、契約と同じ形の 404 を返すこと", async () => {
    // Hono 既定の平文だと、クライアントの分岐が経路によって割れる。
    const response = await app(makeDeps()).request("/nope", { headers });

    expect(response.status).toBe(HttpStatus.NotFound);
    expect(await response.json()).toStrictEqual({
      status: HttpStatus.NotFound,
      code: ErrorCode.ResourceNotFound,
      title: ErrorTitle.ResourceNotFound,
    });
  });

  test("経路にマッチしない場合でも、相関 ID を応答に載せること", async () => {
    // 打ち間違いの調査で手掛かりが消えないように。
    const response = await app(makeDeps()).request("/nope", { headers });

    expect(response.headers.get(HttpHeader.RequestId)).toBe(REQUEST_ID);
  });
});
