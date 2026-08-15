import type { PasswordHasher } from "~/shared/domain/password-hasher";

import { verifyCredentials } from "../domain/services/verify-credentials";
import type { UserRepository } from "../domain/user-repository";
import type { VerifyCredentialsQueryService } from "../public/verify-credentials-query-service";

/**
 * VerifyCredentialsQueryService の実装 (アダプタ)。
 *
 * **SQL も語彙の変換も書かない。担うのは配線だけ。** 照合そのものはドメインサービス
 * `verifyCredentials` にあり、値オブジェクトへの変換は呼ぶ側 (loginCommand) が済ませている。
 */
export const verifyCredentialsQueryService = (deps: {
  readonly userRepository: UserRepository;
  readonly passwordHasher: PasswordHasher;
}): VerifyCredentialsQueryService => ({
  execute: (params) => verifyCredentials(deps, params),
});
