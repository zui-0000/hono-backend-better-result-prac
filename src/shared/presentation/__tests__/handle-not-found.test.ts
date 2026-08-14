import { describe, expect, test } from "bun:test";

import { makeDeps } from "~/__mocks__/app-deps";
import { headers, REQUEST_ID } from "~/__mocks__/data";
import { createApp } from "~/app";
import { ErrorCode } from "~/shared/presentation/constants/error-code";
import { ErrorMessage } from "~/shared/presentation/constants/error-message";
import { HttpHeader } from "~/shared/presentation/constants/http-header";
import { HttpStatus } from "~/shared/presentation/constants/http-status";

import { handleNotFound } from "../handle-not-found";

describe(handleNotFound.name, () => {
  test("未知の経路でも契約と同じ形の 404 を返すこと", async () => {
    // Hono 既定の平文だと、クライアントの分岐が経路によって割れる。
    const response = await createApp(makeDeps()).request("/nope", { headers });

    expect(response.status).toBe(HttpStatus.NotFound);
    expect(await response.json()).toStrictEqual({
      errorCode: ErrorCode.ResourceNotFound,
      message: ErrorMessage.ResourceNotFound,
    });
  });

  test("経路にマッチしなくても相関 ID を応答に載せること", async () => {
    // 打ち間違いの調査で手掛かりが消えないように。
    const response = await createApp(makeDeps()).request("/nope", { headers });

    expect(response.headers.get(HttpHeader.RequestId)).toBe(REQUEST_ID);
  });
});
