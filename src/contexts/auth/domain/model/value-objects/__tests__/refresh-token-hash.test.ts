import { describe, expect, test } from "bun:test";

import { RefreshTokenHash } from "../refresh-token-hash";

/**
 * 自作の正規表現なので、何を通し何を弾くかを固定する。
 *
 * 券そのものは保存せず、この形にして記録する。突き合わせは
 * `findByTokenHash` の素の一致なので、**表記が 2 通りあると静かに失敗する**
 * (保存時と提示時で大小が割れると、行はあるのに引けない)。
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
    // 実装は `Bun.CryptoHasher(...).digest("hex")` で小文字を返す。ここを緩めると
    // 大小違いが別の値として保存され、同じ券を提示しても引けなくなる。
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

  test("16 進以外の文字を弾くこと", () => {
    // 券そのもの (base64url などの平文) が誤って渡る事故を防ぐ。
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
