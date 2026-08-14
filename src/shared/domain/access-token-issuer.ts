import type { Result } from "better-result";
import * as z from "zod";

import type { UnauthorizedError } from "~/shared/errors/unauthorized-error";

import { Uuid } from "./model/uuid";

/**
 * アクセストークン (JWT) に載せる claims。
 *
 * **ここに書いたものは全部クライアントに晒される。** JWT は署名されているだけで
 * 暗号化されていないため payload は誰でも読める。だから名前もメールアドレスも
 * 載せない。必要になったら DB から引く。
 *
 * sub は認可の主体 (誰の)、sid は失効の単位 (どのログインか)。sid に載せるのは
 * 券 1 枚の id ではなく **session_id** (ローテーションを跨いで不変) —
 * 券の id だと、古いアクセストークンを持つタブからのログアウトが空振りする。
 *
 * 型が branded な UserId ではなく素の Uuid なのは、shared が contexts を知らないため
 * (`shared-not-to-contexts`)。brand を付け直すのは受け取った側の仕事。
 */
export const AccessTokenClaims = z.object({
  sub: Uuid,
  sid: Uuid,
});
export type AccessTokenClaims = z.infer<typeof AccessTokenClaims>;

/**
 * アクセストークンの発行と検証を行うポート。実装 (hono/jwt) は infrastructure に置く。
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
