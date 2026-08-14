import * as z from "zod";

import { Uuid } from "./uuid";

/**
 * アクセストークン (JWT) に載せる claims。
 *
 * `claims` は JWT の語彙 (RFC 7519 の「主張」)。`sub` なら「この券の持ち主は
 * この人だ」という主張を指す。ドメインに JWT の語を出してよいのは、**契約が
 * 3 セグメント形式を強制していて JWT であること自体が契約の決定**だから
 * (`schema/src/contexts/auth/model/AccessToken.tsp`)。隠しているのは
 * `hono/jwt` という実装であって、JWT という形式ではない。
 *
 * 寿命 (`iat` / `exp`) はここに持たない。あれは実装が発行時に足すもので、
 * **業務が決める主張ではない**。
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
 *
 * `model/` に置くのは**これが語彙だから**。`domain/` 直下は環境から得るものだけを残す。
 */
export const AccessTokenClaims = z.object({
  sub: Uuid,
  sid: Uuid,
});
export type AccessTokenClaims = z.infer<typeof AccessTokenClaims>;
