import { describe, expect, test } from "bun:test";

import { UserHashedPassword } from "../user-hashed-password";

/**
 * **平文がこの欄に入る事故を防げているか**を固定する。
 *
 * `min`/`max` だけの値オブジェクト (`UserName` など) はテストしない — あれを試すのは
 * zod を試すことになる。ここは**自作の正規表現**で、しかも「長さでは分離できないから
 * 形式で見る」という非自明な判断が入っているのでロジックとして扱う。
 *
 * (実測: 正規表現を `/.*&#47;` に差し替えても型・lint・単体・API のすべてが緑のまま
 *  通った。偽の hasher が返すのが PHC 形式の値だけなので、**拒否側を誰も踏んでいない**)
 */
describe("UserHashedPassword", () => {
  test("PHC 形式のハッシュを通すこと (アルゴリズムは名指ししない)", () => {
    // argon2id / bcrypt / scrypt はどれも `$<識別子>$` で始まる規約に従う。
    // 特定のアルゴリズムに縛らないので、実装を替えても通り続ける。
    for (const hashed of [
      "$argon2id$v=19$m=65536,t=2,p=1$c2FsdA$aGFzaA",
      "$2b$12$abcdefghijklmnopqrstuv",
      "$scrypt$ln=16,r=8,p=1$c2FsdA$aGFzaA",
    ]) {
      expect(UserHashedPassword.safeParse(hashed).success).toBe(true);
    }
  });

  test("**平文を弾くこと**", () => {
    // 防ぎたい事故そのもの。ハッシュ化を挟み忘れて平文が渡ってくる形。
    for (const plainText of [
      "password1234",
      "Str0ng-Passphrase-With-Symbols!",
      "a".repeat(128),
    ]) {
      expect(UserHashedPassword.safeParse(plainText).success).toBe(false);
    }
  });

  test("長さでは分離できないことを踏まえていること", () => {
    // 平文は 12〜128 文字、argon2id は 118 文字、bcrypt は 60 文字。
    // どちらも平文の許容範囲に収まるので、長さで弾く実装にしてはいけない。
    const bcryptLength = "$2b$12$abcdefghijklmnopqrstuv".length;
    const plainTextSameLength = "x".repeat(bcryptLength);

    expect(bcryptLength).toBeGreaterThanOrEqual(12);
    expect(bcryptLength).toBeLessThanOrEqual(128);
    // 同じ長さでも、形式が違えば弾かれる。
    expect(UserHashedPassword.safeParse(plainTextSameLength).success).toBe(
      false,
    );
  });

  test("`$` で始まるだけの紛れ込みは通してしまうこと (承知の限界)", () => {
    // 不透明な値として扱うので中身は解釈しない。`$` 始まりの文字列を
    // わざわざ渡す経路は無く、防ぎたいのは平文の混入なのでここは許容する。
    expect(UserHashedPassword.safeParse("$x$notreallyahash").success).toBe(
      true,
    );
  });
});
