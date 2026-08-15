import { Result } from "better-result";
import * as z from "zod";

import type { Clock } from "~/shared/domain/clock";
import { MailAddress } from "~/shared/domain/model/value-objects/mail-address";
import { Password } from "~/shared/domain/model/value-objects/password";
import type { PasswordHasher } from "~/shared/domain/password-hasher";
import type { UuidGenerator } from "~/shared/domain/uuid-generator";
import type { MailAddressDuplicationError } from "~/shared/errors/mail-address-duplication-error";
import type { RepositoryError } from "~/shared/errors/repository-error";

import { createUser } from "../domain/model/user";
import { UserHashedPassword } from "../domain/model/value-objects/user-hashed-password";
import type { UserId } from "../domain/model/value-objects/user-id";
import { UserName } from "../domain/model/value-objects/user-name";
import { checkMailAddressDuplication } from "../domain/services/check-mail-address-duplication";
import type { UserRepository } from "../domain/user-repository";

export type CreateUserCommandDeps = {
  readonly userRepository: UserRepository;
  readonly passwordHasher: PasswordHasher;
  readonly uuidGenerator: UuidGenerator;
  readonly clock: Clock;
};

export type CreateUserCommandInput = {
  readonly name: string;
  readonly mailAddress: string;
  readonly password: string;
};

const CreateUserCommandValues = z.object({
  name: UserName,
  mailAddress: MailAddress,
  password: Password,
});

export type CreateUserCommandOutput = { readonly id: UserId };

export type CreateUserCommandError =
  | MailAddressDuplicationError
  | RepositoryError;

/**
 * ユーザーを作成する。
 *
 * 重複検証 → ハッシュ化 → 集約の生成 → 永続化。**重複が先**なのは、
 * 弾かれると分かっている入力に argon2 の計算 (~100ms) を払わないため。
 *
 * ハッシュ結果の `UserHashedPassword` への変換で throw するのは、**失敗したら
 * ハッシュ実装が壊れている**ということだから (握り潰すと平文が入りうる)。
 */
export const createUserCommand =
  (deps: CreateUserCommandDeps) =>
  (
    input: CreateUserCommandInput,
  ): Promise<Result<CreateUserCommandOutput, CreateUserCommandError>> =>
    Result.gen(async function* () {
      const { name, mailAddress, password } =
        CreateUserCommandValues.parse(input);

      yield* Result.await(checkMailAddressDuplication(deps, mailAddress));

      const hashedPassword = UserHashedPassword.parse(
        await deps.passwordHasher.hash(password),
      );

      const user = createUser(deps, { name, mailAddress, hashedPassword });

      yield* Result.await(deps.userRepository.create(user));
      return Result.ok({ id: user.id });
    });
