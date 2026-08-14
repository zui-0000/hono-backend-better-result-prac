import { Result } from "better-result";

import { orNotFound } from "~/shared/application/or-not-found";
import type { ForbiddenError } from "~/shared/errors/forbidden-error";
import type { RepositoryError } from "~/shared/errors/repository-error";
import type { ResourceNotFoundError } from "~/shared/errors/resource-not-found-error";

import { checkUserIsSelf } from "../domain/services/check-user-is-self";
import type {
  GetUserQueryInput,
  GetUserQueryOutput,
  GetUserQueryService,
} from "./get-user-query-service";

/**
 * ユーザーを取得する (CQRS のクエリ)。
 *
 * 1. 対象が本人か検証 (他人なら 403。存在は見ない)
 * 2. ポートから射影を取得 (存在しなければ 404)
 *
 * **認可はユースケースの仕事。** controller から直接ポートを叩くと、規則の適用点が
 * コマンドとクエリで割れる。
 *
 * **1 が 2 より先。** 他人の id を指定されたとき **DB を引かずに落ちる** —
 * 「認可の失敗は対象の有無に関わらず 403」がそのまま順序に現れている。
 */
export const createGetUserQuery =
  (deps: { readonly getUserQueryService: GetUserQueryService }) =>
  async (
    input: GetUserQueryInput,
  ): Promise<
    Result<
      GetUserQueryOutput,
      ForbiddenError | ResourceNotFoundError | RepositoryError
    >
  > =>
    await Result.gen(async function* () {
      yield* checkUserIsSelf(input.id, input.actor);

      return orNotFound(
        await deps.getUserQueryService.execute({ id: input.id }),
      );
    });
