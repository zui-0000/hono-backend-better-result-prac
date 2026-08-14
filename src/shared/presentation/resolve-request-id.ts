import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";

import type { UuidGenerator } from "~/shared/domain/uuid-generator";

import { HttpHeader } from "./constants/http-header";

export type RequestIdEnv = {
  Variables: {
    readonly requestId: string;
  };
};

const MAX_LENGTH = 128;

/** ログに載せる値なので、改行や制御文字を弾く (ログインジェクション対策)。 */
const SAFE_PATTERN = /^[\w.-]+$/u;

/**
 * 相関 ID を確定させる。**経路にマッチしないリクエストにも要る**ので、
 * 経路ごとの handleWithResult では覆えず middleware にしかできない。
 *
 * 受け取った値が使えなければ採番し直す。採番は 1 箇所だけ — 2 箇所でやると
 * 応答ヘッダとログに別々の ID が載る。
 */
export const resolveRequestId = (deps: {
  readonly uuidGenerator: UuidGenerator;
}): MiddlewareHandler<RequestIdEnv> =>
  createMiddleware<RequestIdEnv>(async (c, next) => {
    const incoming = c.req.header(HttpHeader.RequestId);
    const requestId =
      incoming !== undefined &&
      incoming.length <= MAX_LENGTH &&
      SAFE_PATTERN.test(incoming)
        ? incoming
        : deps.uuidGenerator.next();

    c.set("requestId", requestId);

    await next();

    // next() の後に載せる。ハンドラが c.json などで応答を作り直すため、
    // 前に置くと上書きされうる。
    c.header(HttpHeader.RequestId, requestId);
  });
