import type { Result } from "better-result";
import type { CookieOptions } from "hono/utils/cookie";
import type * as z from "zod";

import { HttpStatus } from "./constants/http-status";

/**
 * 本文を持てるステータスと、持てないステータス。
 * この区別を決めたのは HTTP であってこちらではない (204 は RFC 9110 §15.3.5 で
 * 本文を持てない)。
 */
type BodyStatus = typeof HttpStatus.Ok | typeof HttpStatus.Created;
type NoBodyStatus = typeof HttpStatus.NoContent;

/** 応答に載せる Cookie。属性の組み立ては所有コンテキストが 1 箇所で持つ。 */
export type ResponseCookie = {
  readonly name: string;
  readonly value: string;
  readonly options: CookieOptions;
};

/**
 * Cookie を載せられる、という性質。**ステータスとは直交する**
 * (ログインは 200+Cookie、取得は 200 のみ、ログアウトは 204+Cookie)。
 * 任意にしてあるので「204 に本文」が書けない元の性質は保たれる。
 */
type WithCookie = { readonly cookie?: ResponseCookie };

/**
 * controller が返す「成功応答の記述」。Hono の `Context` には触れず、
 * 実際の `Response` にするのは `handleWithResult` の仕事。
 *
 * **判別子は `status` そのもの。** 本文を持てるかはステータスが決まれば決まるので、
 * 別に `_tag` を持たせると同じことを 2 箇所で言うことになる。
 */
export type SuccessResponse =
  | ({ readonly status: NoBodyStatus } & WithCookie)
  | ({ readonly status: BodyStatus; readonly body: unknown } & WithCookie);

/**
 * 本文のある応答にする。
 *
 * スキーマは 2 つ仕事をする — 値の型を縛るのと、**契約どおりかを実行時に確かめる**。
 * 後者が要るのは、クエリ側がドメインを経由せず DB の行をそのまま返すから。
 * 契約とズレた応答は**バグ**なので throw して 500 にする (握り潰さない)。
 */
const withBody =
  (status: BodyStatus) =>
  <S extends z.ZodType>(schema: S) =>
  <E>(result: Result<z.input<S>, E>): Result<SuccessResponse, E> =>
    result.map((value) => ({ status, body: schema.parse(value) }));

/** 本文のない応答にする。値は捨てるので、検証するスキーマも受け取らない。 */
const withoutBody =
  (status: NoBodyStatus) =>
  <E>(result: Result<unknown, E>): Result<SuccessResponse, E> =>
    result.map(() => ({ status }));

/**
 * 組み立て済みの応答に Cookie を載せる。
 * `SuccessResponse` の表に混ぜないのは、あれが**ステータスの表**だから。
 */
export const withResponseCookie =
  (cookie: ResponseCookie) =>
  <E>(result: Result<SuccessResponse, E>): Result<SuccessResponse, E> =>
    result.map((response) => ({ ...response, cookie }));

/**
 * 成功応答の作り方。**ステータスと本文の有無が、そのまま表になっている。**
 * controller は名前を選ぶだけで、数字を手で書く場所が無い。
 */
export const SuccessResponse = {
  /** 200。取得系の応答。 */
  Ok: withBody(HttpStatus.Ok),
  /** 201。作成した資源の識別子を返す。 */
  Created: withBody(HttpStatus.Created),
  /** 204。状態を変えるだけで値を返さない (CQRS のコマンド)。 */
  NoContent: withoutBody(HttpStatus.NoContent),
} as const;
