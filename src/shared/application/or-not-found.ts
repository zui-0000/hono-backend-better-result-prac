import { Result } from "better-result";

import { ResourceNotFoundError } from "~/shared/errors/resource-not-found-error";

/**
 * 「見つからなければ 404」というユースケースの方針に名前を与える。
 *
 * 業務ルールではない (ビジネス側に「存在しない ID を指定されたらどうしますか」は
 * 聞けない) ので domain ではなく application に置く。
 *
 * `undefined` → 404 の変換だけを切り出してあるので、書き込み経路 (Repository) も
 * 読み取り経路 (QueryService) も同じ形で書ける。
 */
export const orNotFound = <A, E>(
  result: Result<A | undefined, E>,
): Result<A, E | ResourceNotFoundError> =>
  result.andThen((value) =>
    value === undefined
      ? Result.err(new ResourceNotFoundError())
      : Result.ok(value),
  );
