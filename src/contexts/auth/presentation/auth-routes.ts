import { Hono } from "hono";

import {
  Login200Response,
  LoginBody,
  LoginHeader,
  LogoutHeader,
  Refresh200Response,
  RefreshHeader,
} from "~/generated/auth";
import { handleWithResult } from "~/shared/presentation/handle-with-result";
import type { RequestIdEnv } from "~/shared/presentation/resolve-request-id";

import type { AuthDeps } from "../auth-deps";
import { loginController } from "./controllers/login-controller";
import { logoutController } from "./controllers/logout-controller";
import { refreshController } from "./controllers/refresh-controller";
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
      response: Login200Response,
      controller: loginController(deps),
    })(deps),
  );

  routes.post(
    "/refresh",
    handleWithResult({
      // 券は本文ではなく Cookie で受け取る。契約の `@cookie refreshToken` と 1 対 1。
      request: { header: RefreshHeader, cookie: RefreshCookie },
      response: Refresh200Response,
      controller: refreshController(deps),
    })(deps),
  );

  routes.post(
    "/logout",
    handleWithResult({
      auth: true,
      request: { header: LogoutHeader },
      controller: logoutController(deps),
    })(deps),
  );

  return routes;
};
