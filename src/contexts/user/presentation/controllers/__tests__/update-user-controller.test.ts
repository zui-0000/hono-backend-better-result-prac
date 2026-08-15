import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import { FIXED_UUID, headers, makeUser, OTHER_UUID } from "~/__mocks__/data";
import { app } from "~/app";
import type { AppDeps } from "~/app-deps";
import type { User } from "~/contexts/user/domain/model/user";
import { UserName } from "~/contexts/user/domain/model/value-objects/user-name";
import { ErrorCode } from "~/shared/presentation/constants/error-code";
import { HttpStatus } from "~/shared/presentation/constants/http-status";

import { updateUserController } from "../update-user-controller";

const VALID = { name: "更新後", mailAddress: "updated@example.com" };

const put = async (
  deps: AppDeps,
  id: string = FIXED_UUID,
  body: Record<string, unknown> = VALID,
): Promise<Response> =>
  await app(deps).request(`/users/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

describe(updateUserController.name, () => {
  test("204 を返し、updatedAt だけ進んで createdAt は据え置くこと", async () => {
    const updated: User[] = [];
    const deps = makeDeps({
      userRepository: {
        findById: async () => Result.ok(makeUser()),
        updateProfile: async (user) => {
          updated.push(user);
          return Result.ok();
        },
      },
    });

    const response = await put(deps);

    expect(response.status).toBe(HttpStatus.NoContent);
    expect(await response.text()).toBe("");
    expect(updated[0]?.name).toBe(UserName.parse(VALID.name));
    // 作成日時が更新のたびに書き換わらないこと。
    expect(updated[0]?.createdAt).toStrictEqual(new Date(0));
    expect(updated[0]?.updatedAt).not.toStrictEqual(new Date(0));
    // パスワードは触らない。
    expect(updated[0]?.hashedPassword).toBe(makeUser().hashedPassword);
  });

  test("メールアドレスを変えない更新が 409 にならないこと", async () => {
    // **excluding が効いているか。** 無いと「自分自身がヒットしただけ」を
    // 重複と誤判定し、変えない更新が常に失敗する。
    const deps = makeDeps({
      userRepository: {
        findById: async () => Result.ok(makeUser()),
        findByMailAddress: async () => Result.ok(makeUser()),
      },
    });

    const response = await put(deps, FIXED_UUID, {
      ...VALID,
      mailAddress: "existing@example.com",
    });

    expect(response.status).toBe(HttpStatus.NoContent);
  });

  test("他人が使っているメールアドレスなら 409", async () => {
    const deps = makeDeps({
      userRepository: {
        findById: async () => Result.ok(makeUser()),
        findByMailAddress: async () => Result.ok(makeUser({ id: OTHER_UUID })),
      },
    });

    const response = await put(deps);

    expect(response.status).toBe(HttpStatus.Conflict);
    expect(((await response.json()) as { code: string }).code).toBe(
      ErrorCode.MailAddressDuplication,
    );
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
