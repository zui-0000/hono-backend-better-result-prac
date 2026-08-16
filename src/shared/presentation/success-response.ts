import type { CookieOptions } from "hono/utils/cookie";

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
 *
 * `Body` は**経路が宣言した応答スキーマの入力型**が入る
 * (`handle-with-result.ts` の `Spec.response`)。宣言が無い経路では `never` になり、
 * 本文のある応答を返そうとするとコンパイルエラーになる。
 */
export type SuccessResponse<Body = unknown> =
  | ({ readonly status: NoBodyStatus } & WithCookie)
  | ({ readonly status: BodyStatus; readonly body: Body } & WithCookie);

/**
 * 組み立て済みの応答に Cookie を載せる。
 * `SuccessResponse` の表に混ぜないのは、あれが**ステータスの表**だから。
 */
export const withResponseCookie =
  (cookie: ResponseCookie) =>
  <Body>(response: SuccessResponse<Body>): SuccessResponse<Body> => ({
    ...response,
    cookie,
  });

/**
 * 成功応答の作り方。**ステータスと本文の有無が、そのまま表になっている。**
 * controller は名前を選ぶだけで、数字を手で書く場所が無い。
 *
 * **契約で検証するのはここではない。** 応答スキーマは経路が宣言し、
 * `handleWithResult` が返す直前に `.parse()` する。ここで受け取ると
 * controller が生成物を引き回すことになり、リクエストの契約 (経路が持つ) と
 * 置き場が割れる。
 */
export const SuccessResponse = {
  /** 200。取得系の応答。 */
  Ok: <Body>(body: Body): SuccessResponse<Body> => ({
    status: HttpStatus.Ok,
    body,
  }),
  /** 201。作成した資源の識別子を返す。 */
  Created: <Body>(body: Body): SuccessResponse<Body> => ({
    status: HttpStatus.Created,
    body,
  }),
  /** 204。状態を変えるだけで値を返さない (CQRS のコマンド)。 */
  NoContent: (): SuccessResponse<never> => ({ status: HttpStatus.NoContent }),
} as const;
