import { describe, expect, test } from "bun:test";

import { RefreshTokenHash } from "../refresh-token-hash";

/**
 * 自作の正規表現なので、何を通し何を弾くかを固定する。
 *
 * 一番効くのは**券とハッシュの取り違えを弾くこと**。`issue()` が返す
 * `{ token, hash }` はどちらも `string` で、型では区別が付かない。
 */
describe("RefreshTokenHash", () => {
  test("SHA-256 の 16 進 64 桁を通すこと", () => {
    expect(RefreshTokenHash.safeParse("0".repeat(64)).success).toBe(true);
    expect(
      RefreshTokenHash.safeParse(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      ).success,
    ).toBe(true);
  });

  test("大文字を弾くこと", () => {
    // 今の実装 (`Bun.CryptoHasher(...).digest("hex")`) は小文字しか返さないので、
    // これは**将来ハッシュ実装を替えたとき**の網。tokenHash は一意制約の張られた
    // キーで素の一致で引くため、綴りを 1 通りに固定しておく。
    // (`z.hash("sha256")` を採らなかったのもこの 1 点。実測で大文字を通した)
    expect(RefreshTokenHash.safeParse("A".repeat(64)).success).toBe(false);
    expect(RefreshTokenHash.safeParse(`${"a".repeat(63)}A`).success).toBe(
      false,
    );
  });

  test("桁数が違えば弾くこと", () => {
    // SHA-256 は必ず 64 桁。長さが違うのは別のアルゴリズムか切り詰められた値で、
    // どちらも突き合わせが成立しない。
    expect(RefreshTokenHash.safeParse("a".repeat(63)).success).toBe(false);
    expect(RefreshTokenHash.safeParse("a".repeat(65)).success).toBe(false);
    expect(RefreshTokenHash.safeParse("").success).toBe(false);
  });

  test("券そのものを弾くこと", () => {
    // **この正規表現を置いている一番の理由。** `issue()` の戻りは { token, hash } で
    // どちらも string なので、取り違えても型は通る。渡ってしまうと平文の券が
    // そのまま DB に入り、ダンプ 1 つで全セッションが盗める。
    // 券は `rt_` + base64url(32 バイト) の 46 文字 (refresh-token-issuer.ts)。
    const token = "rt_zCU3ZrwG7F-F_JAbBK3wu7g3OlR3bSnuKPaSuP2RCoE";

    expect(token).toHaveLength(46);
    expect(RefreshTokenHash.safeParse(token).success).toBe(false);
  });

  test("16 進以外の文字を弾くこと", () => {
    expect(RefreshTokenHash.safeParse(`${"a".repeat(63)}g`).success).toBe(
      false,
    );
    expect(RefreshTokenHash.safeParse(`${"a".repeat(63)}-`).success).toBe(
      false,
    );
  });

  test("前後の空白を許さないこと", () => {
    expect(RefreshTokenHash.safeParse(` ${"a".repeat(64)}`).success).toBe(
      false,
    );
    expect(RefreshTokenHash.safeParse(`${"a".repeat(64)}\n`).success).toBe(
      false,
    );
  });
});
