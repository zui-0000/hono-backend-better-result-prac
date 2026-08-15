import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";

import { Uuid } from "~/shared/domain/model/uuid";
import type { UuidGenerator } from "~/shared/domain/uuid-generator";

import { HttpHeader } from "./constants/http-header";

export type RequestIdEnv = {
  Variables: {
    readonly requestId: string;
  };
};

/**
 * 相関 ID を確定させる。**経路にマッチしないリクエストにも要る**ので、
 * 経路ごとの handleWithResult では覆えず middleware にしかできない。
 *
 * **契約では任意**なので、送られてこなければ採番する。**ここが唯一の入口**なので、
 * ログと応答ヘッダに載る値は必ず uuid v7 になる。
 *
 * 形が違う値も採番し直す。契約を持つ経路では `validateRequest` が先に 400 で弾くが、
 * **経路にマッチしないリクエストと /health はそこを通らない** — その 2 つのために
 * ここでも見る必要がある。
 *
 * 判定を `Uuid` に寄せたので、ログインジェクションの心配も同時に消える
 * (uuid v7 は長さが固定で制御文字を含まないため、通った値は必ず安全)。
 *
 * 採番は 1 箇所だけ — 2 箇所でやると応答ヘッダとログに別々の ID が載る。
 */
export const resolveRequestId = (deps: {
  readonly uuidGenerator: UuidGenerator;
}): MiddlewareHandler<RequestIdEnv> =>
  createMiddleware<RequestIdEnv>(async (c, next) => {
    const incoming = Uuid.safeParse(c.req.header(HttpHeader.RequestId));
    const requestId = incoming.success
      ? incoming.data
      : deps.uuidGenerator.generate();

    c.set("requestId", requestId);

    await next();

    // next() の後に載せる。ハンドラが c.json などで応答を作り直すため、
    // 前に置くと上書きされうる。
    c.header(HttpHeader.RequestId, requestId);
  });
