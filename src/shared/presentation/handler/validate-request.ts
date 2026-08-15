import { Result } from "better-result";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type * as z from "zod";

import { BadRequestError } from "~/shared/errors/bad-request-error";

import { ErrorTitle } from "../constants/error-title";
import { HttpHeader } from "../constants/http-header";
import { decodeInput } from "../decode-input";
import type { AuthenticatedInput } from "./verify-bearer";

/**
 * 経路の宣言 (`RequestSchemas`) に従って、HTTP の各入力源を契約で検証する。
 * 入力源ごとの取り出し方だけが違い、検証そのものは `decodeInput` に委ねる。
 *
 *   body   … `c.req.json()`
 *   header … `c.req.header()`   契約が期待するキーへ揃えてから渡す
 *   params … `c.req.param()`    パスパラメータ (/users/:id の :id)
 *   query  … `c.req.query()`    繰り返し指定は最初の 1 つだけ返る
 *   cookie … `getCookie(c)`     Cookie 名は大文字小文字を区別する
 *
 * 認証は扱わない (`verify-bearer.ts` の担当。実行も**こちらより先**)。
 */

const validateJson = async <S extends z.ZodType>(
  c: Context,
  schema: S,
): Promise<Result<z.infer<S>, BadRequestError>> => {
  try {
    return decodeInput(schema)(await c.req.json());
  } catch {
    return Result.err(new BadRequestError({ title: ErrorTitle.MalformedJson }));
  }
};

/** HTTP のヘッダ名は大文字小文字を区別しない。Hono は小文字で返すので揃える。 */
const validateHeader = <S extends z.ZodType>(
  c: Context,
  schema: S,
  headerNames: readonly string[],
): Result<z.infer<S>, BadRequestError> => {
  const received = c.req.header();
  const source = Object.fromEntries(
    headerNames.map((name) => [name, received[name.toLowerCase()]]),
  );
  return decodeInput(schema)(source);
};

/** リクエストのどの入力源を検証するかの宣言。header は全経路必須 (相関 ID)。 */
export type RequestSchemas = {
  readonly header: z.ZodType;
  readonly body?: z.ZodType;
  readonly params?: z.ZodType;
  readonly query?: z.ZodType;
  readonly cookie?: z.ZodType;
};

/**
 * 宣言した入力源に対応する、検証済みの値の形。
 * 宣言していない入力源は型に現れないので、controller で誤って使うと落ちる。
 */
export type ValidatedRequest<Req extends RequestSchemas> = {
  readonly [
    K in keyof Req as Req[K] extends z.ZodType ? K : never
  ]: Req[K] extends z.ZodType ? z.infer<Req[K]> : never;
};

/** controller が受け取る引数。検証済みの入力 + claims (要る経路だけ) + 生の Context。 */
export type ControllerInput<
  Req extends RequestSchemas,
  Auth extends true | undefined,
> = ValidatedRequest<Req> &
  AuthenticatedInput<Auth> & {
    readonly c: Context;
  };

/** ヘッダから見るのは、相関 ID が全リクエスト必須だから (まずそこで弾く)。 */
export const validateRequest = async <Req extends RequestSchemas>(
  c: Context,
  request: Req,
): Promise<Result<ValidatedRequest<Req>, BadRequestError>> =>
  await Result.gen(async function* () {
    const validated: Record<string, unknown> = {};

    validated["header"] = yield* validateHeader(c, request.header, [
      HttpHeader.RequestId,
    ]);
    if (request.body !== undefined) {
      validated["body"] = yield* Result.await(validateJson(c, request.body));
    }
    if (request.params !== undefined) {
      validated["params"] = yield* decodeInput(request.params)(c.req.param());
    }
    if (request.query !== undefined) {
      validated["query"] = yield* decodeInput(request.query)(c.req.query());
    }
    if (request.cookie !== undefined) {
      validated["cookie"] = yield* decodeInput(request.cookie)(getCookie(c));
    }

    return Result.ok(validated as ValidatedRequest<Req>);
  });
