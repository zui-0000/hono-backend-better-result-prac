import type { SessionRevoker } from "~/contexts/auth/public/session-revoker";
import type { PasswordHasher } from "~/shared/domain/password-hasher";
import type { SharedDeps } from "~/shared/shared-deps";

import type { GetUserQueryService } from "./application/get-user-query";
import type { UserRepository } from "./domain/user-repository";

/**
 * user コンテキストを動かすのに必要なもの (要求側の宣言)。
 *
 * **ポートしか import しない。** 実装 (infrastructure) を知るのは合成ルートだけ。
 * ここで組み立てまでやると `no-indirect-path-to-impl` が落ちる — presentation が
 * **型のためだけに**このファイルを import しているため、実装を混ぜた瞬間に
 * user-routes.ts から全アダプタへ経路が通る (実測)。
 *
 * 横断ポートは `SharedDeps` に寄せ、**ここには user 固有のものだけ**を並べる。
 * このコンテキストが何を要求するかが名前で読め、足りなければ利用側
 * (user-routes.ts) でコンパイルエラーになる。
 */
export type UserDeps = SharedDeps & {
  readonly userRepository: UserRepository;
  readonly getUserQueryService: GetUserQueryService;
  // 照合とハッシュ化は user の業務なので、auth 側は要求しない。
  readonly passwordHasher: PasswordHasher;
  // 退会とパスワード変更が auth のセッションを畳むため (auth/public/ のポート)。
  // user は券の存在も Repository も知らず、「切る」という動詞だけを借りる。
  readonly sessionRevoker: SessionRevoker;
};
