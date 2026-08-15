import { describe, expect, test } from "bun:test";

import { makeDeps } from "~/__mocks__/app-deps";
import { FIXED_UUID, REQUEST_ID } from "~/__mocks__/data";
import { app } from "~/app";
import { HttpHeader } from "~/shared/presentation/constants/http-header";
import { HttpStatus } from "~/shared/presentation/constants/http-status";

import { resolveRequestId } from "../resolve-request-id";

const health = async (
  requestHeaders: Record<string, string> = {},
): Promise<Response> =>
  await app(makeDeps()).request("/health", { headers: requestHeaders });

/** 契約を持つ経路。相関 ID が本文の可否に影響しないことを、ここで見る。 */
const createUser = async (
  requestHeaders: Record<string, string> = {},
): Promise<Response> =>
  await app(makeDeps()).request("/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...requestHeaders },
    body: JSON.stringify({
      name: "テスト太郎",
      mailAddress: "new@example.com",
      password: "password1234",
    }),
  });

describe(resolveRequestId.name, () => {
  describe("受け取った値の扱い", () => {
    test("uuid v7 が送られてきた場合、そのまま応答に載せること", async () => {
      const response = await health({ [HttpHeader.RequestId]: REQUEST_ID });

      expect(response.headers.get(HttpHeader.RequestId)).toBe(REQUEST_ID);
    });

    test("送られてこない場合、採番すること", async () => {
      const response = await health();

      expect(response.headers.get(HttpHeader.RequestId)).toBe(FIXED_UUID);
    });

    test.each([
      ["uuid ですらない", "not-a-uuid"],
      ["空白や記号を含む", "not a safe id!"],
      ["長すぎる", "a".repeat(129)],
      ["uuid v4", "9f1b8c2e-3d4a-4b5c-8d6e-7f8091a2b3c4"],
    ])(
      "%s 値 (%s) の場合、採番した値で置き換えること",
      async (_label, incoming) => {
        // 判定を `Uuid` に寄せてある。**形が違えば採番し直す**ので、
        // ログと応答ヘッダに載る値は必ず uuid v7 になり、
        // 制御文字が混ざる余地 (ログインジェクション) も同時に消える。
        const response = await health({ [HttpHeader.RequestId]: incoming });

        expect(response.headers.get(HttpHeader.RequestId)).toBe(FIXED_UUID);
      },
    );
  });

  describe("本文への影響", () => {
    test("契約のある経路でも、送られてこない場合は採番して通すこと", async () => {
      // **以前はここが 400 だった** — middleware が採番したうえで、
      // 契約側の検証が必須ヘッダの欠落として弾いていた。
      const response = await createUser();

      expect(response.status).toBe(HttpStatus.Created);
      expect(response.headers.get(HttpHeader.RequestId)).toBe(FIXED_UUID);
    });

    test("契約のある経路で形が違う値を送った場合、400 で教えること", async () => {
      // **宣言したものは検証する。** 黙って無視すると、クライアントは
      // 相関が永遠に効かないことに気付けない。
      //
      // このとき応答ヘッダに載るのは**採番し直した値**。受け取った壊れた値を
      // そのまま返すと、ログに使えない値が応答に出ていくことになる。
      const response = await createUser({
        [HttpHeader.RequestId]: "not-a-uuid",
      });

      expect(response.status).toBe(HttpStatus.BadRequest);
      expect(
        (
          (await response.json()) as {
            errors: { field: string; message: string }[];
          }
        ).errors,
      ).toStrictEqual([
        { field: HttpHeader.RequestId, message: expect.any(String) },
      ]);
      expect(response.headers.get(HttpHeader.RequestId)).toBe(FIXED_UUID);
    });
  });
});
