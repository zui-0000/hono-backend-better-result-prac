import type { Result } from "better-result";

import type { MailAddress } from "~/shared/domain/model/value-objects/mail-address";
import type { MailAddressDuplicationError } from "~/shared/errors/mail-address-duplication-error";
import type { RepositoryError } from "~/shared/errors/repository-error";

import type { User } from "./model/user";
import type { UserId } from "./model/value-objects/user-id";

/**
 * User 集約の永続化ポート (書き込み側 / CQRS のコマンド経路)。
 */
export type UserRepository = {
  readonly create: (
    user: User,
  ) => Promise<Result<void, MailAddressDuplicationError | RepositoryError>>;
  /** 名前とメールアドレスだけを書く (changeUserProfile の結果を永続化する)。 */
  readonly updateProfile: (
    user: User,
  ) => Promise<Result<void, MailAddressDuplicationError | RepositoryError>>;
  /** ハッシュ済みパスワードだけを書く (changeUserPassword の結果を永続化する)。 */
  readonly updatePassword: (
    user: User,
  ) => Promise<Result<void, RepositoryError>>;
  readonly findById: (
    id: UserId,
  ) => Promise<Result<User | undefined, RepositoryError>>;
  readonly findByMailAddress: (
    mailAddress: MailAddress,
  ) => Promise<Result<User | undefined, RepositoryError>>;
  readonly deleteById: (id: UserId) => Promise<Result<void, RepositoryError>>;
};
