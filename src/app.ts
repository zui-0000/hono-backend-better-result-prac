import { Hono } from "hono";

import { authRoutes } from "~/contexts/auth/presentation/auth-routes";
import { userRoutes } from "~/contexts/user/presentation/user-routes";
import { handleNotFound } from "~/shared/presentation/handle-not-found";
import {
  type RequestIdEnv,
  resolveRequestId,
} from "~/shared/presentation/resolve-request-id";

import type { AppDeps } from "./app-deps";

/**
 * アプリ全体を組み立てる。知っているのは「どのコンテキストをどのパスにマウントするか」だけ。
 *
 * 依存を引数で受け取るので、テストでは偽の実装を渡すだけで HTTP 境界ごと検証できる。
 *
 * middleware は 1 枚だけ。相関 ID は**経路にマッチしなかったリクエストにも要る**ため、
 * 経路ごとの handleWithResult では覆えない。認証と契約検証は経路ごとに要否が変わる。
 */
export const createApp = (deps: AppDeps) => {
  const app = new Hono<RequestIdEnv>();

  app.use("*", resolveRequestId(deps));
  app.notFound(handleNotFound);

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.route("/users", userRoutes(deps));
  app.route("/auth", authRoutes(deps));

  return app;
};
