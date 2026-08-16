import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import {
  FAKE_CALLER,
  FAKE_HASH,
  FIXED_UUID,
  headers,
  makeUser,
  OTHER_UUID,
} from "~/__mocks__/data";
import { app } from "~/app";
import type { AppDeps } from "~/app-deps";
import type { User } from "~/contexts/user/domain/model/user";
import { UserHashedPassword } from "~/contexts/user/domain/model/value-objects/user-hashed-password";
import { ErrorCode } from "~/shared/presentation/constants/error-code";
import { HttpStatus } from "~/shared/presentation/constants/http-status";

import { changePasswordController } from "../change-password-controller";

const VALID = {
  currentPassword: "currentpass1234",
  newPassword: "newpassword1234",
};

const put = async (deps: AppDeps, id: string = FIXED_UUID): Promise<Response> =>
  await app(deps).request(`/users/${id}/password`, {
    method: "PUT",
    headers,
    body: JSON.stringify(VALID),
  });

describe(changePasswordController.name, () => {
  test("現在のパスワードが正しい場合、204 を返し変わるのはハッシュと updatedAt だけであること", async () => {
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

  test("現在のパスワードが違う場合、4011 を返し永続化しないこと", async () => {
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

  test("他人の id の場合、403 を返すこと", async () => {
    const response = await put(makeDeps(), OTHER_UUID);
    expect(response.status).toBe(HttpStatus.Forbidden);
  });

  test("存在しない場合、404 を返すこと", async () => {
    const response = await put(makeDeps());
    expect(response.status).toBe(HttpStatus.NotFound);
  });

  test("現在のパスワードが正しい場合、いま操作している端末以外のセッションを切ること", async () => {
    // 変えたい動機の大半は「漏れたかもしれない」。切らないと
    // **盗んだ側のセッションだけが生き残る** (実測で踏んだ)。
    const revoked: unknown[] = [];
    const deps = makeDeps({
      userRepository: { findById: async () => Result.ok(makeUser()) },
      sessionRevoker: {
        revokeUserSessions: async (params) => {
          revoked.push(params);
          return Result.ok();
        },
      },
    });

    const response = await put(deps);

    expect(response.status).toBe(HttpStatus.NoContent);
    // excluding は claims の sid。変えた本人まで追い出さない。
    expect(revoked).toStrictEqual([
      { userId: FIXED_UUID, excluding: FAKE_CALLER.sessionId },
    ]);
  });

  test("現在のパスワードが正しい場合、失効を済ませてから差し替えること", async () => {
    // 逆順だと、差し替えは通ったのに失効で落ちたとき盗まれた券が生き残り、
    // しかも再試行できない (currentPassword が既に古く 401 になる)。
    const order: string[] = [];
    const deps = makeDeps({
      userRepository: {
        findById: async () => Result.ok(makeUser()),
        updatePassword: async () => {
          order.push("update");
          return Result.ok();
        },
      },
      sessionRevoker: {
        revokeUserSessions: async () => {
          order.push("revoke");
          return Result.ok();
        },
      },
    });

    await put(deps);

    expect(order).toStrictEqual(["revoke", "update"]);
  });

  test("現在のパスワードが違う場合、失効も走らないこと", async () => {
    // 打ち間違い 1 回で全端末が落ちると、盗難検出より先に自分が困る。
    const order: string[] = [];
    const deps = makeDeps({
      userRepository: { findById: async () => Result.ok(makeUser()) },
      passwordHasher: { verify: async () => false },
      sessionRevoker: {
        revokeUserSessions: async () => {
          order.push("revoke");
          return Result.ok();
        },
      },
    });

    const response = await put(deps);

    expect(response.status).toBe(HttpStatus.Unauthorized);
    expect(order).toStrictEqual([]);
  });
});
