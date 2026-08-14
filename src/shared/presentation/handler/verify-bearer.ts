import { Result } from "better-result";
import type { Context } from "hono";

import type {
  AccessTokenClaims,
  AccessTokenIssuer,
} from "~/shared/domain/access-token-issuer";
import { UnauthorizedError } from "~/shared/errors/unauthorized-error";

import { HttpHeader } from "../constants/http-header";

const BEARER_PATTERN = /^Bearer (.+)$/u;

/**
 * 認証が要る経路にだけ `auth` が生える。宣言していない controller では
 * **型に存在しない**ので、うっかり参照するとコンパイルエラーになる。
 */
export type AuthenticatedInput<Required> = true extends Required
  ? { readonly auth: AccessTokenClaims }
  : Record<never, never>;

export const verifyBearer = async (
  deps: { readonly accessTokenIssuer: AccessTokenIssuer },
  c: Context,
): Promise<Result<AccessTokenClaims, UnauthorizedError>> => {
  const header = c.req.header(HttpHeader.Authorization);
  const token = header?.match(BEARER_PATTERN)?.[1];
  if (token === undefined) {
    return Result.err(new UnauthorizedError());
  }
  return await deps.accessTokenIssuer.verify(token);
};

export const verifyAuth = async <Required extends true | undefined>(
  deps: { readonly accessTokenIssuer: AccessTokenIssuer },
  c: Context,
  required: Required,
): Promise<Result<AuthenticatedInput<Required>, UnauthorizedError>> => {
  if (required !== true) {
    return Result.ok({} as AuthenticatedInput<Required>);
  }
  const verified = await verifyBearer(deps, c);
  return verified.map((auth) => ({ auth }) as AuthenticatedInput<Required>);
};
