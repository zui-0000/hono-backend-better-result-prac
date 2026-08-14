import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import { FIXED_UUID, headers, makeUser, OTHER_UUID } from "~/__mocks__/data";
import { createApp } from "~/app";
import type { AppDeps } from "~/app-deps";
import { HttpStatus } from "~/shared/presentation/constants/http-status";

import { createDeleteUserController } from "../delete-user-controller";

const del = async (deps: AppDeps, id: string = FIXED_UUID): Promise<Response> =>
  await createApp(deps).request(`/users/${id}`, { method: "DELETE", headers });

describe(createDeleteUserController.name, () => {
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
});
