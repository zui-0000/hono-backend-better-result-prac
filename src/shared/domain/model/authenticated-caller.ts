import * as z from "zod";

import { Uuid } from "./uuid";

/**
 * 認証を通った相手。**誰が (`userId`)、どのログインで (`sessionId`)**。
 *
 * JWT の語彙 (`claims` / `sub` / `sid`) はここに出さない。あれは
 * `shared/infrastructure/access-token-issuer.ts` が話す言葉で、契約が強制しているのは
 * **トークンが 3 セグメントに見えること**だけ (`AccessToken.tsp` の `@pattern`)。
 * 項目名はクライアントが読むものではないので、内側はアプリの言葉で通す。
 *
 * **ここに載せたものは全部クライアントに晒される。** JWT は署名されているだけで
 * 暗号化されていないため payload は誰でも読める。だから名前もメールアドレスも
 * 載せない。必要になったら DB から引く。
 *
 * 寿命 (発行時刻と期限) を持たないのは、**業務の決めごとではない**から。
 * 発行のたびにアダプタが足す。
 *
 * `sessionId` が指すのは券 1 枚ではなく**セッション** (ローテーションを跨いで不変)。
 * 券 1 枚の id だと、古いアクセストークンを持つタブからのログアウトが空振りする。
 *
 * 型が branded な `UserId` / `SessionId` ではなく素の `Uuid` なのは、shared が
 * contexts を知らないため (`shared-not-to-contexts`)。brand を付け直すのは受け取った側
 * (各コマンドの 1 行目) の仕事で、素のまま domain へ渡そうとすると型が止める。
 */
export const AuthenticatedCaller = z.object({
  userId: Uuid,
  sessionId: Uuid,
});
export type AuthenticatedCaller = z.infer<typeof AuthenticatedCaller>;
