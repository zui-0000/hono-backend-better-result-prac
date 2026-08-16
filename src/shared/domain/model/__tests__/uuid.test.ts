import { describe, expect, test } from "bun:test";

import { Uuid } from "../uuid";

/**
 * 自作の正規表現なので、**何を通し何を弾くか**を固定する。
 *
 * 契約 (`schema/src/shared/model/Uuid.tsp`) の `@pattern` と同じ文字列が
 * 手書きされている。片方だけ直すと静かにズレるので、触るときは両方見ること。
 */
describe("Uuid", () => {
  test("UUID v7 の場合、通すこと", () => {
    expect(Uuid.safeParse("018eef15-1234-7123-8123-123456789abc").success).toBe(
      true,
    );
  });

  test("大文字が混ざる場合、弾くこと", () => {
    // ここが緩むと id の表記が 2 通り生まれる。`checkUserIsSelf` は id を素の
    // `===` で比べるので、大小が混ざると**本人なのに 403** になる。しかも
    // 全部緑のまま通るので気付けない。`z.uuidv7()` を採らなかったのはこの 1 点。
    expect(Uuid.safeParse("018EEF15-1234-7123-8123-123456789ABC").success).toBe(
      false,
    );
    expect(Uuid.safeParse("018eef15-1234-7123-8123-123456789ABC").success).toBe(
      false,
    );
  });

  test("v7 以外の版の場合、弾くこと", () => {
    // 採番は v7 に統一している (時系列で並ぶため索引が効く)。版を混ぜると
    // その前提が崩れる。`z.uuid()` は版を問わないので採らなかった。
    expect(Uuid.safeParse("f47ac10b-58cc-4372-a567-0e02b2c3d479").success).toBe(
      false,
    ); // v4
    expect(Uuid.safeParse("c232ab00-9414-11ec-b3c8-9e6bdeced846").success).toBe(
      false,
    ); // v1
    expect(Uuid.safeParse("00000000-0000-0000-0000-000000000000").success).toBe(
      false,
    ); // nil
  });

  test("variant ビットが RFC 9562 の範囲外の場合、弾くこと", () => {
    // 第 4 区画の頭は `[89ab]` に限られる。ここを見ていないと、版だけ 7 に
    // 書き換えた出自不明の文字列が通る。
    expect(Uuid.safeParse("018eef15-1234-7123-c123-123456789abc").success).toBe(
      false,
    );
  });

  test("形が違う場合、弾くこと", () => {
    // 前後の空白を許すと、DB では別の行になるのに `===` では同じに見える値が
    // 生まれる。アンカー (`^`/`$`) があることの確認でもある。
    expect(
      Uuid.safeParse(" 018eef15-1234-7123-8123-123456789abc ").success,
    ).toBe(false);
    expect(Uuid.safeParse("018eef15123471238123123456789abc").success).toBe(
      false,
    );
  });
});
