import type { NotFoundHandler } from "hono";

import { ResourceNotFoundError } from "~/shared/errors/resource-not-found-error";

import { handleErrorResponse } from "./handler/handle-error-response";
import type { RequestIdEnv } from "./resolve-request-id";

/**
 * 経路にマッチしなかったリクエストの 404。
 * Hono 既定の平文ではなく**契約と同じ形**で返す (クライアントの分岐が割れないよう)。
 */
export const handleNotFound: NotFoundHandler<RequestIdEnv> = (c) => {
  const { status, body } = handleErrorResponse(new ResourceNotFoundError());
  return c.json(body, status);
};
