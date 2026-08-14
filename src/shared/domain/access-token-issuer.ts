import type { Result } from "better-result";

import type { UnauthorizedError } from "~/shared/errors/unauthorized-error";

import type { AccessTokenClaims } from "./model/access-token-claims";

/**
 * アクセストークンの発行と検証を行うポート。
 * **Bun を隠したのと同じ理由で Hono を隠す** — hono は presentation の道具。
 *
 * shared に置くのは検証側が横断的に要るから。発行するのは auth だけだが、
 * Bearer の検証は全コンテキストのルートに掛かる。
 *
 * 失敗が `UnauthorizedError` の 1 種類しか無いのは意図的。期限切れ・署名不正・
 * 形式不正を書き分けると攻撃側に手掛かりを与える。
 */
export type AccessTokenIssuer = {
  readonly issue: (claims: AccessTokenClaims) => Promise<string>;
  readonly verify: (
    token: string,
  ) => Promise<Result<AccessTokenClaims, UnauthorizedError>>;
};
