import { describe, expect, test } from "bun:test";

import { MailAddress } from "../mail-address";

/**
 * 自作の正規表現なので、**何を通し何を弾くか**を固定する。あわせて
 * **値を変えないこと**（小文字へ潰さない）を固定する。
 *
 * 契約 (`schema/src/shared/model/MailAddress.tsp`) の `@pattern` と同じ文字列が
 * 手書きされている。片方だけ直すと静かにズレるので、触るときは両方見ること。
 */
describe("MailAddress", () => {
  test("大小を保存すること", () => {
    // 潰すと元の表記を復元できず、送信時に届くかどうかを受信サーバの設定に
    // 賭けることになる (RFC 5321 §2.4 はローカル部の大小保存を要求する)。
    // 一意性は DB 側の `lower(mail_address)` 一意索引が担保するので、
    // ここで正規化する必要が無い。
    const original = "Taro.Yamada@Example.COM";
    expect(String(MailAddress.parse(original))).toBe(original);
  });

  test("RFC 5322 の記号を含むローカル部を通すこと", () => {
    // `z.email()` を採らなかった理由。あれはこの形を弾くので、契約 (同じ regex を
    // 生成 zod が使う) を通った入力がドメインで throw して **500** になる。
    expect(
      MailAddress.safeParse("user!#$%&'*+/=?^_`{|}~-@example.com").success,
    ).toBe(true);
    expect(MailAddress.safeParse("taro.yamada@example.com").success).toBe(true);
  });

  test("単文字のラベルだけのアドレスを通すこと", () => {
    // `a@b.c` も同じく `z.email()` との差が出た入力。TLD の実在は確かめない
    // (確かめるには一覧を抱えることになり、更新できずに古びる)。
    expect(MailAddress.safeParse("a@b.c").success).toBe(true);
  });

  test("ドットの位置の規則を守らせること", () => {
    // ローカル部のドットは区切りにしか使えない。RFC 5322 は引用符で囲めば
    // これらも認めるが、この正規表現は引用形式を扱わないので通らない。
    for (const invalid of [
      "taro..yamada@example.com",
      ".taro@example.com",
      "taro.@example.com",
    ]) {
      expect(MailAddress.safeParse(invalid).success).toBe(false);
    }
  });

  test("アドレスの形が破れているものを弾くこと", () => {
    // ドメイン部にドットを 1 つ以上求めるので、`user@localhost` のような
    // 内部宛ても通らない。末尾のハイフンは DNS のラベル規則違反。
    for (const invalid of [
      "userexample.com",
      "user@example",
      "user@exa-.com",
    ]) {
      expect(MailAddress.safeParse(invalid).success).toBe(false);
    }
  });

  test("255 文字を上限にすること", () => {
    // DB の列幅と契約の `@maxLength` に合わせた値。
    const max = `${"a".repeat(243)}@example.com`;
    expect(max).toHaveLength(255);
    expect(MailAddress.safeParse(max).success).toBe(true);
    expect(MailAddress.safeParse(`a${max}`).success).toBe(false);
  });
});
