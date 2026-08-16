import { describe, expect, test } from "bun:test";

import type { Clock } from "~/shared/domain/clock";
import { MailAddress } from "~/shared/domain/model/value-objects/mail-address";
import { Password } from "~/shared/domain/model/value-objects/password";
import type { PasswordHasher } from "~/shared/domain/password-hasher";
import type { UuidGenerator } from "~/shared/domain/uuid-generator";

import {
  changeUserPassword,
  changeUserProfile,
  createUser,
  type User,
  verifyUserPassword,
} from "../user";
import { UserHashedPassword } from "../value-objects/user-hashed-password";
import { UserName } from "../value-objects/user-name";

const NOW = new Date("2026-08-14T12:00:00.000Z");
const CREATED = new Date("2020-01-01T00:00:00.000Z");
const NEW_ID = "019fa5bc-0000-7000-8000-000000000000";

const clock: Clock = { now: () => NOW };
const uuidGenerator: UuidGenerator = { generate: () => NEW_ID };

const HASH = UserHashedPassword.parse(
  "$argon2id$v=19$m=65536,t=2,p=1$c2FsdA$existing",
);
const NEW_HASH = UserHashedPassword.parse(
  "$argon2id$v=19$m=65536,t=2,p=1$c2FsdA$updated",
);

/** 既存の集約。作成日時を過去にして、更新で動くかを見分けられるようにする。 */
const registeredUser: User = {
  id: NEW_ID as User["id"],
  name: UserName.parse("既存の名前"),
  mailAddress: MailAddress.parse("existing@example.com"),
  hashedPassword: HASH,
  createdAt: CREATED,
  updatedAt: CREATED,
};

describe(createUser.name, () => {
  test("採番した id と、作成/更新に同じ時刻を入れること", () => {
    const user = createUser(
      { uuidGenerator, clock },
      {
        name: UserName.parse("テスト太郎"),
        mailAddress: MailAddress.parse("new@example.com"),
        hashedPassword: HASH,
      },
    );

    expect(user.id).toBe(NEW_ID as User["id"]);
    // 生成直後は同じ時刻。updatedAt が createdAt より後になると「作成即更新」に見える。
    expect(user.createdAt).toStrictEqual(NOW);
    expect(user.updatedAt).toStrictEqual(NOW);
  });

  test("渡されたハッシュをそのまま持つこと (ここで再ハッシュしない)", () => {
    const user = createUser(
      { uuidGenerator, clock },
      {
        name: UserName.parse("テスト太郎"),
        mailAddress: MailAddress.parse("new@example.com"),
        hashedPassword: HASH,
      },
    );

    expect(user.hashedPassword).toBe(HASH);
  });
});

describe(changeUserProfile.name, () => {
  test("名前とメールアドレスだけを変え、updatedAt を進めること", () => {
    const updated = changeUserProfile({ clock }, registeredUser, {
      name: UserName.parse("新しい名前"),
      mailAddress: MailAddress.parse("updated@example.com"),
    });

    expect(updated.name).toBe(UserName.parse("新しい名前"));
    expect(updated.mailAddress).toBe(MailAddress.parse("updated@example.com"));
    expect(updated.updatedAt).toStrictEqual(NOW);
    // **作成日時は据え置き。** 更新のたびに書き換わると「いつ登録したか」が消える。
    expect(updated.createdAt).toStrictEqual(CREATED);
    // パスワードは別の操作。ここで触ると変更が巻き戻る。
    expect(updated.hashedPassword).toBe(HASH);
    expect(updated.id).toBe(registeredUser.id);
  });

  test("元の集約を書き換えないこと", () => {
    // 呼び出し側が古い集約を握り続けても変更が波及しない、という約束。
    changeUserProfile({ clock }, registeredUser, {
      name: UserName.parse("新しい名前"),
      mailAddress: MailAddress.parse("updated@example.com"),
    });

    expect(registeredUser.name).toBe(UserName.parse("既存の名前"));
    expect(registeredUser.updatedAt).toStrictEqual(CREATED);
  });
});

describe(changeUserPassword.name, () => {
  test("ハッシュと updatedAt だけを変えること", () => {
    const updated = changeUserPassword({ clock }, registeredUser, NEW_HASH);

    expect(updated.hashedPassword).toBe(NEW_HASH);
    expect(updated.updatedAt).toStrictEqual(NOW);
    // 名前・メールアドレス・作成日時が巻き戻らないこと。
    expect(updated.name).toBe(registeredUser.name);
    expect(updated.mailAddress).toBe(registeredUser.mailAddress);
    expect(updated.createdAt).toStrictEqual(CREATED);
  });

  test("元の集約を書き換えないこと", () => {
    changeUserPassword({ clock }, registeredUser, NEW_HASH);

    expect(registeredUser.hashedPassword).toBe(HASH);
  });
});

describe(verifyUserPassword.name, () => {
  test("**渡された平文と保存済みハッシュを突き合わせること**", async () => {
    // ここが逆になると、実装によっては**どんな平文でも通る**。
    // API テストの偽 hasher は引数を無視するので、この取り違えは検出できない。
    const received: [string, string][] = [];
    const passwordHasher: PasswordHasher = {
      hash: async () => HASH,
      verify: async (plainText, hashed) => {
        received.push([plainText, hashed]);
        return true;
      },
    };

    await verifyUserPassword(
      { passwordHasher },
      registeredUser,
      Password.parse("plaintext1234"),
    );

    expect(received).toStrictEqual([["plaintext1234", HASH]]);
  });

  test("一致する場合、成功を返すこと", async () => {
    const passwordHasher: PasswordHasher = {
      hash: async () => HASH,
      verify: async () => true,
    };

    const result = await verifyUserPassword(
      { passwordHasher },
      registeredUser,
      Password.parse("plaintext1234"),
    );

    expect(result.isOk()).toBe(true);
  });

  test("一致しない場合、PasswordMismatchError で失敗すること", async () => {
    const passwordHasher: PasswordHasher = {
      hash: async () => HASH,
      verify: async () => false,
    };

    const result = await verifyUserPassword(
      { passwordHasher },
      registeredUser,
      Password.parse("wrongpassword"),
    );

    expect(result.isOk()).toBe(false);
    expect(result.isOk() ? null : result.error._tag).toBe(
      "PasswordMismatchError",
    );
  });
});
