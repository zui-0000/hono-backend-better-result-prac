import { Result } from "better-result";
import * as z from "zod";

import type { Clock } from "~/shared/domain/clock";
import { MailAddress } from "~/shared/domain/model/value-objects/mail-address";
import type { Password } from "~/shared/domain/model/value-objects/password";
import type { PasswordHasher } from "~/shared/domain/password-hasher";
import type { UuidGenerator } from "~/shared/domain/uuid-generator";
import { UnauthorizedError } from "~/shared/errors/unauthorized-error";

import { UserHashedPassword } from "./value-objects/user-hashed-password";
import { generateUserId, UserId } from "./value-objects/user-id";
import { UserName } from "./value-objects/user-name";

/**
 * User 集約ルート。フレームワーク非依存の純粋なドメインモデル。
 * イミュータブル: 値を書き換えず、状態を変える操作は新しい User を返す。
 *
 * バレル (index.ts) を置かない方針のため、エクスポート名はそれ自体で何の集約かが
 * 分かる形にする (Model ではなく User、create ではなく createUser)。
 *
 * **依存は第 1 引数で受ける。** ユースケース (application) がファクトリで依存を
 * 先に食わせるのに対し、ドメインの関数は呼び出し側が既に持っているものを渡すだけ。
 * 配線は 1 箇所 (合成ルート) に集めたいが、ここは配線点ではない。
 */
export const User = z.object({
  id: UserId,
  name: UserName,
  mailAddress: MailAddress,
  hashedPassword: UserHashedPassword,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type User = z.infer<typeof User>;

/** 新規ユーザーを生成する (id を採番し、作成/更新日時を現在時刻に)。 */
export const createUser = (
  deps: { readonly uuidGenerator: UuidGenerator; readonly clock: Clock },
  params: {
    readonly name: UserName;
    readonly mailAddress: MailAddress;
    readonly hashedPassword: UserHashedPassword;
  },
): User => {
  const timestamp = deps.clock.now();
  return {
    id: generateUserId(deps.uuidGenerator),
    name: params.name,
    mailAddress: params.mailAddress,
    hashedPassword: params.hashedPassword,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

/**
 * プロフィール (名前・メールアドレス) を変更した集約を返す。
 *
 * 元の User は書き換えない。呼び出し側が古い集約を握り続けても変更が波及しない。
 * API 契約が PUT (全置換) なので「変更後の値で差し替える」操作として表現する。
 * id / createdAt / hashedPassword は変わらないため引数に取らない。
 */
export const changeUserProfile = (
  deps: { readonly clock: Clock },
  user: User,
  params: { readonly name: UserName; readonly mailAddress: MailAddress },
): User => ({
  ...user,
  name: params.name,
  mailAddress: params.mailAddress,
  updatedAt: deps.clock.now(),
});

/**
 * 渡された平文が、このユーザーの現在のパスワードであることを確かめる。
 *
 * **ドメインサービスではなく集約に置いている。** この問いは User 集約 1 つを見れば
 * 答えが出るため、集約に属さない操作の受け皿であるドメインサービスの条件を満たさない。
 * 一方でユースケースの方針でもない —「パスワード変更のとき現在のパスワードを確認するか」は
 * ビジネス側に聞ける問いなので、業務ルールとして内側に置く。
 */
export const verifyUserPassword = async (
  deps: { readonly passwordHasher: PasswordHasher },
  user: User,
  plainText: Password,
): Promise<Result<void, UnauthorizedError>> => {
  const matched = await deps.passwordHasher.verify(
    plainText,
    user.hashedPassword,
  );
  return matched ? Result.ok() : Result.err(new UnauthorizedError());
};

/**
 * パスワードを変更した集約を返す。
 *
 * 受け取るのはハッシュ済みの値だけで、平文も本人確認もここには現れない
 * (照合は verifyUserPassword、ハッシュ化は application の責務)。
 */
export const changeUserPassword = (
  deps: { readonly clock: Clock },
  user: User,
  hashedPassword: UserHashedPassword,
): User => ({
  ...user,
  hashedPassword,
  updatedAt: deps.clock.now(),
});
