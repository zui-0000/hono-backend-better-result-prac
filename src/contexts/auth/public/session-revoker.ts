import type { Result } from "better-result";

import type { UserId } from "~/contexts/user/domain/model/value-objects/user-id";
import type { RepositoryError } from "~/shared/errors/repository-error";

import type { SessionId } from "../domain/model/value-objects/session-id";

/**
 * 利用者のセッションを失効させるポート。
 *
 * **auth が user の求めに応じて公開している面** (Customer/Supplier)。
 * `user/public/verify-credentials-query-service.ts` と向きが逆で、こちらは
 * auth → user への供給にあたる。
 *
 * **引き金が user 側の出来事**なのがこのポートの存在理由。退会もパスワード変更も
 * user の業務だが、券を持っているのは auth。口が無いと「消したはずの利用者が
 * 有効な券を持ち続ける」「パスワードを変えても盗まれた端末が生き残る」ことになる
 * (どちらも実測で踏んだ)。
 *
 * `RefreshTokenRepository` を渡さないのは、あれが create / rotate まで握らせるから。
 * user に要るのは「切る」という動詞ひとつだけ。
 *
 * 失効時刻を引数に取らないのは、**いつ失効したかを決めるのが auth の都合**だから
 * (行に残る監査の値で、呼ぶ側が決めるものではない)。
 */
export type SessionRevoker = {
  /**
   * その利用者の券をすべて失効させる。
   *
   * `excluding` に渡したセッションだけ残す。パスワード変更で**いま操作している端末を
   * 落とさない**ために要る (退会では渡さないので全部切れる)。
   */
  readonly revokeUserSessions: (params: {
    readonly userId: UserId;
    readonly excluding?: SessionId;
  }) => Promise<Result<void, RepositoryError>>;
};
