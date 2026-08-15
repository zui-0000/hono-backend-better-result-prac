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
import { ErrorCode } from "~/shared/presentation/constants/error-code";
import { HttpStatus } from "~/shared/presentation/constants/http-status";

import { createChangePasswordController } from "../change-password-controller";

const VALID = {
  currentPassword: "currentpass1234",
  newPassword: "newpassword1234",
};

const put = async (deps: AppDeps, id: string = FIXED_UUID): Promise<Response> =>
  await createApp(deps).request(`/users/${id}/password`, {
    method: "PUT",
    headers,
    body: JSON.stringify(VALID),
  });

describe(createChangePasswordController.name, () => {
  test("204 を返し、変わるのはハッシュと updatedAt だけであること", async () => {
    const updated: User[] = [];
    const deps = makeDeps({
      userRepository: {
        findById: async () => Result.ok(makeUser()),
        updatePassword: async (user) => {
          updated.push(user);
          return Result.ok();
        },
      },
    });

    const response = await put(deps);

    expect(response.status).toBe(HttpStatus.NoContent);
    expect(updated[0]?.hashedPassword).toBe(
      UserHashedPassword.parse(FAKE_HASH),
    );
    // 名前・メールアドレス・作成日時は巻き戻らないこと。
    expect(updated[0]?.name).toBe(makeUser().name);
    expect(updated[0]?.mailAddress).toBe(makeUser().mailAddress);
    expect(updated[0]?.createdAt).toStrictEqual(new Date(0));
  });

  test("現在のパスワードが違えば 4011 を返し、永続化しないこと", async () => {
    // **トークンを盗まれてもパスワードは変えられない**という守り。
    //
    // status ではなく code を見る。汎用 401 (4010) と同じステータスなので、
    // ここを見ないと打ち間違いと区別できているか確かめられない。
    const updated: User[] = [];
    const deps = makeDeps({
      userRepository: {
        findById: async () => Result.ok(makeUser()),
        updatePassword: async (user) => {
          updated.push(user);
          return Result.ok();
        },
      },
      passwordHasher: { verify: async () => false },
    });

    const response = await put(deps);

    expect(response.status).toBe(HttpStatus.Unauthorized);
    expect(((await response.json()) as { code: string }).code).toBe(
      ErrorCode.PasswordMismatch,
    );
    expect(updated).toStrictEqual([]);
  });

  test("他人の id なら 403", async () => {
    const response = await put(makeDeps(), OTHER_UUID);
    expect(response.status).toBe(HttpStatus.Forbidden);
  });

  test("存在しなければ 404", async () => {
    const response = await put(makeDeps());
    expect(response.status).toBe(HttpStatus.NotFound);
  });
});
