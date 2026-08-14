import { Hono } from "hono";

import {
  ChangePasswordBody,
  ChangePasswordHeader,
  ChangePasswordParams,
  CreateUserBody,
  CreateUserHeader,
  DeleteUserHeader,
  DeleteUserParams,
  GetUserHeader,
  GetUserParams,
  UpdateUserBody,
  UpdateUserHeader,
  UpdateUserParams,
} from "~/generated/users";
import { handleWithResult } from "~/shared/presentation/handle-with-result";
import type { RequestIdEnv } from "~/shared/presentation/resolve-request-id";

import type { UserDeps } from "../user-deps";
import { createChangePasswordController } from "./controllers/change-password-controller";
import { createCreateUserController } from "./controllers/create-user-controller";
import { createDeleteUserController } from "./controllers/delete-user-controller";
import { createGetUserController } from "./controllers/get-user-controller";
import { createUpdateUserController } from "./controllers/update-user-controller";

/**
 * user コンテキストの HTTP 経路。パスは TypeSpec の `@route` と対応する。
 *
 * **HTTP 契約の宣言をここに集約している** — 入力 (header / body / params) も
 * 認証の要否も、このファイルを見れば一望できる。
 *
 * `auth: true` は契約の `@useAuth(BearerAuth)` と 1 対 1。作成 (サインアップ想定) だけが
 * 認証不要で、残る 4 本は Bearer を要求する。
 *
 * **ここが依存を controller へ食わせる点。** 以降の層に deps は現れない。
 */
export const userRoutes = (deps: UserDeps): Hono<RequestIdEnv> => {
  const routes = new Hono<RequestIdEnv>();

  routes.post(
    "/",
    handleWithResult({
      request: { header: CreateUserHeader, body: CreateUserBody },
      controller: createCreateUserController(deps),
    })(deps),
  );

  routes.get(
    "/:id",
    handleWithResult({
      auth: true,
      request: { header: GetUserHeader, params: GetUserParams },
      controller: createGetUserController(deps),
    })(deps),
  );

  routes.put(
    "/:id",
    handleWithResult({
      auth: true,
      request: {
        header: UpdateUserHeader,
        body: UpdateUserBody,
        params: UpdateUserParams,
      },
      controller: createUpdateUserController(deps),
    })(deps),
  );

  routes.put(
    "/:id/password",
    handleWithResult({
      auth: true,
      request: {
        header: ChangePasswordHeader,
        body: ChangePasswordBody,
        params: ChangePasswordParams,
      },
      controller: createChangePasswordController(deps),
    })(deps),
  );

  routes.delete(
    "/:id",
    handleWithResult({
      auth: true,
      request: { header: DeleteUserHeader, params: DeleteUserParams },
      controller: createDeleteUserController(deps),
    })(deps),
  );

  return routes;
};
