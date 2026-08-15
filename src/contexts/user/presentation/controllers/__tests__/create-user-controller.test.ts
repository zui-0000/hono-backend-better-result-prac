import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import {
  FAKE_HASH,
  FIXED_UUID,
  headers,
  makeUser,
  OTHER_UUID,
} from "~/__mocks__/data";
import { createApp } from "~/app";
import type { AppDeps } from "~/app-deps";
import type { User } from "~/contexts/user/domain/model/user";
import { UserHashedPassword } from "~/contexts/user/domain/model/value-objects/user-hashed-password";
import { MailAddress } from "~/shared/domain/model/value-objects/mail-address";
import { ErrorCode } from "~/shared/presentation/constants/error-code";
import { ErrorTitle } from "~/shared/presentation/constants/error-title";
import { HttpStatus } from "~/shared/presentation/constants/http-status";

import { createCreateUserController } from "../create-user-controller";

const VALID = {
  name: "テスト太郎",
  mailAddress: "new@example.com",
  password: "password1234",
};

const post = async (
  deps: AppDeps,
  body: Record<string, unknown> = VALID,
): Promise<Response> =>
  await createApp(deps).request("/users", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

describe(createCreateUserController.name, () => {
  describe("正常系", () => {
    test("201 と採番した id を返し、ハッシュ済みで保存すること", async () => {
      const created: User[] = [];
      const deps = makeDeps({
        userRepository: {
          create: async (user) => {
            created.push(user);
            return Result.ok();
          },
        },
      });

      const response = await post(deps);

      expect(response.status).toBe(HttpStatus.Created);
      expect(await response.json()).toStrictEqual({ id: FIXED_UUID });

      // **平文が保存されていないこと。** ハッシュ化を挟み忘れる事故がいちばん怖い。
      expect(created).toHaveLength(1);
      expect(created[0]?.hashedPassword).toBe(
        UserHashedPassword.parse(FAKE_HASH),
      );
      expect(created[0]?.mailAddress).toBe(
        MailAddress.parse(VALID.mailAddress),
      );
    });
  });

  describe("異常系", () => {
    test("メールアドレスが重複していれば 409 を返し、保存しないこと", async () => {
      const created: User[] = [];
      const deps = makeDeps({
        userRepository: {
          findByMailAddress: async () =>
            Result.ok(makeUser({ id: OTHER_UUID })),
          create: async (user) => {
            created.push(user);
            return Result.ok();
          },
        },
      });

      const response = await post(deps);

      expect(response.status).toBe(HttpStatus.Conflict);
      expect(await response.json()).toStrictEqual({
        status: HttpStatus.Conflict,
        code: ErrorCode.MailAddressDuplication,
        title: ErrorTitle.MailAddressDuplication,
      });
      // 重複が先に弾くので、ハッシュ計算も保存も走らない。
      expect(created).toStrictEqual([]);
    });

    test("ボディがオブジェクトですらない場合、field が空にならないこと", async () => {
      // path が取れないときに空文字を返すと、field が必須項目なのに
      // 「どこが悪いか」を何も伝えない値になる。
      const response = await createApp(makeDeps()).request("/users", {
        method: "POST",
        headers,
        body: JSON.stringify("これはオブジェクトですらない"),
      });

      expect(response.status).toBe(HttpStatus.BadRequest);
      expect(
        (
          (await response.json()) as {
            errors: { field: string; message: string }[];
          }
        ).errors,
      ).toStrictEqual([{ field: "-", message: expect.any(String) }]);
    });

    test("契約に反する入力は 400 と違反フィールドを返すこと", async () => {
      const response = await post(makeDeps(), {
        name: "",
        mailAddress: "not-a-mail",
        password: "short",
      });

      expect(response.status).toBe(HttpStatus.BadRequest);
      const body = (await response.json()) as {
        code: string;
        errors: { field: string }[];
      };
      expect(body.code).toBe(ErrorCode.BadRequest);
      expect(body.errors.map((d) => d.field).sort()).toStrictEqual([
        "mailAddress",
        "name",
        "password",
      ]);
    });
  });
});
