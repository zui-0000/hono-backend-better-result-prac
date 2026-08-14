import { Hono } from "hono";

import {
  LoginBody,
  LoginHeader,
  LogoutHeader,
  RefreshHeader,
} from "~/generated/auth";
import { handleWithResult } from "~/shared/presentation/handle-with-result";
import type { RequestIdEnv } from "~/shared/presentation/resolve-request-id";

import type { AuthDeps } from "../auth-deps";
import { createLoginController } from "./controllers/login-controller";
import { createLogoutController } from "./controllers/logout-controller";
import { createRefreshController } from "./controllers/refresh-controller";
import { RefreshCookie } from "./refresh-cookie";

/**
 * auth コンテキストの HTTP 経路。
 * logout だけが Bearer を要する (refresh は Cookie の券で認証する)。
 */
export const authRoutes = (deps: AuthDeps): Hono<RequestIdEnv> => {
  const routes = new Hono<RequestIdEnv>();

  routes.post(
    "/login",
    handleWithResult({
      request: { header: LoginHeader, body: LoginBody },
      controller: createLoginController(deps),
    })(deps),
  );

  routes.post(
    "/refresh",
    handleWithResult({
      // 券は本文ではなく Cookie で受け取る。契約の `@cookie refreshToken` と 1 対 1。
      request: { header: RefreshHeader, cookie: RefreshCookie },
      controller: createRefreshController(deps),
    })(deps),
  );

  routes.post(
    "/logout",
    handleWithResult({
      auth: true,
      request: { header: LogoutHeader },
      controller: createLogoutController(deps),
    })(deps),
  );

  return routes;
};
