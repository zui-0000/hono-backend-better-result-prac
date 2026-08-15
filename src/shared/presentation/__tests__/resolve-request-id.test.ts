import { describe, expect, test } from "bun:test";

import { makeDeps } from "~/__mocks__/app-deps";
import { FIXED_UUID, REQUEST_ID } from "~/__mocks__/data";
import { app } from "~/app";
import { HttpHeader } from "~/shared/presentation/constants/http-header";

import { resolveRequestId } from "../resolve-request-id";

const health = async (
  requestHeaders: Record<string, string> = {},
): Promise<Response> =>
  await app(makeDeps()).request("/health", { headers: requestHeaders });

describe(resolveRequestId.name, () => {
  test("受け取った相関 ID をそのまま応答に載せること", async () => {
    const response = await health({ [HttpHeader.RequestId]: REQUEST_ID });

    expect(response.headers.get(HttpHeader.RequestId)).toBe(REQUEST_ID);
  });

  test("送られてこなければ採番すること", async () => {
    const response = await health();

    expect(response.headers.get(HttpHeader.RequestId)).toBe(FIXED_UUID);
  });

  test("安全でない値は採番した値で置き換えること", async () => {
    // ログに出す値なので、空白や記号を含むものは採番し直す
    // (そのまま出すとログインジェクションの余地が残る)。
    // 改行そのものは Hono がリクエスト組み立て時に弾くため、ここでは試せない。
    const response = await health({
      [HttpHeader.RequestId]: "not a safe id!",
    });

    expect(response.headers.get(HttpHeader.RequestId)).toBe(FIXED_UUID);
  });

  test("長すぎる値も採番した値で置き換えること", async () => {
    const response = await health({ [HttpHeader.RequestId]: "a".repeat(129) });

    expect(response.headers.get(HttpHeader.RequestId)).toBe(FIXED_UUID);
  });
});
