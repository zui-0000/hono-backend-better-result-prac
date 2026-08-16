import { Result } from "better-result";
import type { Handler } from "hono";
import { setCookie } from "hono/cookie";
import type * as z from "zod";

import type { AccessTokenIssuer } from "~/shared/domain/access-token-issuer";
import { InternalServerError } from "~/shared/errors/internal-server-error";

import { HttpStatus } from "./constants/http-status";
import {
  type ApplicationError,
  handleErrorResponse,
} from "./handler/handle-error-response";
import { logFailure } from "./handler/log-failure";
import {
  type ControllerInput,
  type RequestSchemas,
  validateRequest,
} from "./handler/validate-request";
import { verifyAuth } from "./handler/verify-bearer";
import type { RequestIdEnv } from "./resolve-request-id";
import type { SuccessResponse } from "./success-response";

/** 経路が応答スキーマを宣言していなければ `never` = 本文を持てない。 */
type ResponseBody<Res> = Res extends z.ZodType ? z.input<Res> : never;

/**
 * エンドポイントの宣言。**キーが実行の段と 1 対 1 で対応する。**
 *
 *   auth       → verifyAuth        （省くと認証しない）
 *   request    → validateRequest
 *   controller → controller
 *   response   → validateResponse  （省くと 204 しか返せない）
 *
 * `auth` を `request` に入れないのは、あちらが「入力源 → スキーマ」の表で、
 * 認証だけスキーマを持たないため。契約の `@useAuth(BearerAuth)` と 1 対 1。
 *
 * **`response` も入れないのは、あちらが「入力源」の表だから。** ただし
 * 応答の契約をここに置く理由は同じ — HTTP の契約は経路の宣言に集める。
 */
type Spec<
  Req extends RequestSchemas,
  Auth extends true | undefined,
  Res extends z.ZodType | undefined,
> = {
  readonly auth?: Auth;
  readonly request: Req;
  readonly response?: Res;
  readonly controller: (
    input: ControllerInput<Req, Auth>,
  ) => Promise<Result<SuccessResponse<ResponseBody<Res>>, ApplicationError>>;
};

/**
 * 応答が契約どおりかを実行時に確かめる。
 *
 * 要るのは**クエリ側がドメインを経由せず DB の行をそのまま返す**から。型は手で
 * 宣言しているだけなので、実際のデータがズレても型検査は素通りする。
 * 契約とズレた応答は**バグ**なので throw して 500 にする (握り潰さない)。
 *
 * **`Result.gen` の中で呼ぶこと。** 外で throw すると Hono 既定の平文 500 になり、
 * 契約と違う形の応答が出る。
 */
const validateResponse = (
  schema: z.ZodType | undefined,
  responded: SuccessResponse,
): SuccessResponse => {
  if (responded.status === HttpStatus.NoContent) {
    return responded;
  }
  if (schema === undefined) {
    // 型で防いでいる (response の無い経路は 204 しか返せない) ので、ここへは来ない。
    throw new Error("応答スキーマが宣言されていない経路が本文を返しました。");
  }
  return { ...responded, body: schema.parse(responded.body) };
};

/**
 * ユースケースの関数から HTTP ハンドラを組み立てる。
 *
 * 実行の流れ。**責務ごとに 1 段ずつ並べてある。**
 *   1. 認証する            (verifyAuth。宣言が無い経路では何もしない)
 *   2. 契約で検証する      (validateRequest)
 *   3. controller を実行する
 *   4. HTTP 応答に変換する
 *   5. 失敗と throw を畳む
 *
 * **認証が先。** 通っていない相手には契約の話を一切しない
 * (400 の errors はフィールド名と制約をそのまま返すため)。
 *
 * **ここが要求する依存は `accessTokenIssuer` だけ。** ユースケース側の依存は
 * routes の時点で部分適用済みなので、この層を通らない。
 */
export const handleWithResult =
  <
    Req extends RequestSchemas,
    Auth extends true | undefined = undefined,
    Res extends z.ZodType | undefined = undefined,
  >(
    spec: Spec<Req, Auth, Res>,
  ) =>
  (deps: {
    readonly accessTokenIssuer: AccessTokenIssuer;
  }): Handler<RequestIdEnv> =>
  async (c) => {
    const requestId = c.get("requestId");

    let outcome: Result<SuccessResponse, ApplicationError>;
    try {
      outcome = await Result.gen(async function* () {
        const authenticated = yield* Result.await(
          verifyAuth(deps, c, spec.auth),
        );
        const validated = yield* Result.await(validateRequest(c, spec.request));
        const responded = yield* Result.await(
          spec.controller({
            ...validated,
            ...authenticated,
            c,
          } as ControllerInput<Req, Auth>),
        );
        return Result.ok(validateResponse(spec.response, responded));
      });
    } catch (defect) {
      // 型付きエラーに翻訳できない失敗。放っておくと Hono 既定の平文 500 が返り、
      // 契約と違う形になったうえログも残らない。
      // **InternalServerError に包んで、下の翻訳と同じ経路へ流す** —
      // 500 の出口を 2 つ持つと、片方だけ形が変わっても気付けない。
      outcome = Result.err(new InternalServerError({ cause: defect }));
    }

    if (!outcome.isOk()) {
      const response = handleErrorResponse(outcome.error);
      logFailure(c, requestId, response.status, outcome.error);
      return c.json(response.body, response.status);
    }

    const responded = outcome.value;

    // Set-Cookie は本文の有無に関わらず積む (ログアウトは 204 + Cookie 削除)。
    // **応答を作る前**に呼ぶ必要がある — c.json / c.body は組み立て済みの
    // Response を返すので、その後にヘッダを足しても反映されない。
    if (responded.cookie !== undefined) {
      const { name, value, options } = responded.cookie;
      setCookie(c, name, value, options);
    }

    // 204 は本文を持てないので c.json を通さない。通すと本文が空でも
    // Content-Type: application/json が載り、中身があると名乗る応答になる。
    return responded.status === HttpStatus.NoContent
      ? c.body(null, responded.status)
      : c.json(responded.body as object, responded.status);
  };
