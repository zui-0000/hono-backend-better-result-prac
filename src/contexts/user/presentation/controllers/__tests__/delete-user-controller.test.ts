import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import { FIXED_UUID, headers, makeUser, OTHER_UUID } from "~/__mocks__/data";
import { app } from "~/app";
import type { AppDeps } from "~/app-deps";
import { HttpStatus } from "~/shared/presentation/constants/http-status";

import { deleteUserController } from "../delete-user-controller";

const del = async (deps: AppDeps, id: string = FIXED_UUID): Promise<Response> =>
  await app(deps).request(`/users/${id}`, { method: "DELETE", headers });

describe(deleteUserController.name, () => {
  test("204 を返し、その id で削除すること", async () => {
    const deleted: string[] = [];
    const deps = makeDeps({
      userRepository: {
        findById: async () => Result.ok(makeUser()),
        deleteById: async (id) => {
          deleted.push(id);
          return Result.ok();
        },
      },
    });

    const response = await del(deps);

    expect(response.status).toBe(HttpStatus.NoContent);
    expect(deleted).toStrictEqual([FIXED_UUID]);
  });

  test("存在しなければ 404 を返し、削除も走らないこと", async () => {
    // 無い相手を消して 204 を返さない (指定が誤っていると教えるほうを採った)。
    const deleted: string[] = [];
    const deps = makeDeps({
      userRepository: {
        deleteById: async (id) => {
          deleted.push(id);
          return Result.ok();
        },
      },
    });

    const response = await del(deps);

    expect(response.status).toBe(HttpStatus.NotFound);
    expect(deleted).toStrictEqual([]);
  });

  test("他人の id なら 403", async () => {
    const response = await del(makeDeps(), OTHER_UUID);
    expect(response.status).toBe(HttpStatus.Forbidden);
  });

  test("退会したらセッションも切ること", async () => {
    // 券に FK が張られていないので DB は後始末をしてくれない。切らないと
    // **消えた利用者が有効な券を持ち続け、無期限に再発行できる** (実測で踏んだ)。
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

    const response = await del(deps);

    expect(response.status).toBe(HttpStatus.NoContent);
    // excluding は渡さない = 全端末を落とす。退会に「残す端末」は無い。
    expect(revoked).toStrictEqual([{ userId: FIXED_UUID }]);
  });

  test("失効を済ませてから消すこと", async () => {
    // 逆順だと、失効に失敗したとき「消えた利用者の券だけが生きている」状態が残り、
    // 再試行しても直らない (相手はもう居ないので 404 になる)。
    const order: string[] = [];
    const deps = makeDeps({
      userRepository: {
        findById: async () => Result.ok(makeUser()),
        deleteById: async () => {
          order.push("delete");
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

    await del(deps);

    expect(order).toStrictEqual(["revoke", "delete"]);
  });

  test("存在しなければ失効も走らないこと", async () => {
    const order: string[] = [];
    const deps = makeDeps({
      sessionRevoker: {
        revokeUserSessions: async () => {
          order.push("revoke");
          return Result.ok();
        },
      },
    });

    const response = await del(deps);

    expect(response.status).toBe(HttpStatus.NotFound);
    expect(order).toStrictEqual([]);
  });
});
