import { Result } from "better-result";
import * as z from "zod";

import type { SessionRevoker } from "~/contexts/auth/public/session-revoker";
import type { ForbiddenError } from "~/shared/errors/forbidden-error";
import type { RepositoryError } from "~/shared/errors/repository-error";
import { ResourceNotFoundError } from "~/shared/errors/resource-not-found-error";

import { UserId } from "../domain/model/value-objects/user-id";
import { checkUserIsSelf } from "../domain/services/check-user-is-self";
import type { UserRepository } from "../domain/user-repository";

export const DeleteUserCommandInput = z.object({
  id: UserId,
  actor: UserId,
});
export type DeleteUserCommandInput = z.infer<typeof DeleteUserCommandInput>;

export type DeleteUserCommandError =
  | ForbiddenError
  | ResourceNotFoundError
  | RepositoryError;

/**
 * ユーザーを削除する。
 *
 * 削除の前に引き当てるのは、**無い相手を消して 204 を返さない**ため
 * (DELETE の冪等性より「指定が誤っている」と教えるほうを採った)。
 *
 * **セッションを切ってから消す。** 逆順だと、失効に失敗したとき
 * 「消えた利用者の券だけが生きている」状態が残り、しかも再試行で直らない
 * (相手はもう居ないので 404 になる)。この順なら失敗しても残るのは
 * 「まだ居る利用者が全端末からログアウトされた」だけで、入り直せば済む。
 *
 * 券に FK が張られていないので、DB は後始末をしてくれない
 * (auth/infrastructure/drizzle-schema.ts に理由がある)。**塞ぐのはここ。**
 */
export const deleteUserCommand =
  (deps: {
    readonly userRepository: UserRepository;
    readonly sessionRevoker: SessionRevoker;
  }) =>
  async (
    input: DeleteUserCommandInput,
  ): Promise<Result<void, DeleteUserCommandError>> =>
    await Result.gen(async function* () {
      yield* checkUserIsSelf(input.id, input.actor);

      // 引き当てるのは存在確認のため。集約そのものは使わない。
      const found = yield* Result.await(deps.userRepository.findById(input.id));
      if (found === undefined) {
        return Result.err(new ResourceNotFoundError());
      }

      yield* Result.await(
        deps.sessionRevoker.revokeUserSessions({ userId: input.id }),
      );

      yield* Result.await(deps.userRepository.deleteById(input.id));
      return Result.ok();
    });
