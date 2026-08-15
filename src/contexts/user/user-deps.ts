import type { SessionRevoker } from "~/contexts/auth/public/session-revoker";
import type { AccessTokenIssuer } from "~/shared/domain/access-token-issuer";
import type { Clock } from "~/shared/domain/clock";
import type { PasswordHasher } from "~/shared/domain/password-hasher";
import type { UuidGenerator } from "~/shared/domain/uuid-generator";

import type { GetUserQueryService } from "./application/get-user-query";
import type { UserRepository } from "./domain/user-repository";

/**
 * user コンテキストを動かすのに必要なもの (要求側の宣言)。
 *
 * **ポートしか import しない。** 実装 (infrastructure) を知るのは合成ルートだけで、
 * ここが実装を参照すると `no-indirect-path-to-impl` が落ちる。
 *
 * このコンテキストが**何を要求するか**が名前で読める形にしてある。
 * 足りなければ利用側 (user-routes.ts) でコンパイルエラーになる。
 */
export type UserDeps = {
  readonly userRepository: UserRepository;
  readonly getUserQueryService: GetUserQueryService;
  readonly passwordHasher: PasswordHasher;
  readonly uuidGenerator: UuidGenerator;
  readonly clock: Clock;
  // Bearer の検証は handleWithResult が行うため、認証を要求する経路が
  // 1 本でもあるコンテキストはこれを要求する。
  readonly accessTokenIssuer: AccessTokenIssuer;
  // 退会とパスワード変更が auth のセッションを畳むため (auth/public/ のポート)。
  // user は券の存在も Repository も知らず、「切る」という動詞だけを借りる。
  readonly sessionRevoker: SessionRevoker;
};
