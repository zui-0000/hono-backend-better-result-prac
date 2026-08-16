import { describe, expect, test } from "bun:test";

import { UserName } from "../user-name";

/**
 * `min`/`max` の組み合わせだけなので zod の挙動を試す部分は書かない
 * (文字列以外を弾くこと、など)。固定したいのは**この値オブジェクトが下した判断**:
 * 1〜100 という業務が決めた範囲、文字種を制限しないこと、値を整形しないこと。
 *
 * 契約 (`schema/src/contexts/users/model/UserName.tsp`) にも同じ数字が手書きされている。
 * 片方だけ直すと静かにズレるので、値を触るときは両方見ること。
 */
describe("UserName", () => {
  test("境界の内側 (1 文字と 100 文字) の場合、通すこと", () => {
    expect(UserName.safeParse("あ").success).toBe(true);
    expect(UserName.safeParse("あ".repeat(100)).success).toBe(true);
  });

  test("境界の外側 (0 文字と 101 文字) の場合、弾くこと", () => {
    // 空文字を通すと「名前が無い利用者」が生まれる。
    expect(UserName.safeParse("").success).toBe(false);
    expect(UserName.safeParse("あ".repeat(101)).success).toBe(false);
  });

  test("記号や絵文字を含む場合でも、通すこと", () => {
    // 表示のための名前で識別子ではないので、記号や絵文字を弾く理由が無い。
    // ここが落ちたら誰かが `.regex()` を足した合図。足すなら契約側にも要る。
    for (const name of ["山田 太郎", "Taro Yamada", "🐈", "a-b_c.d"]) {
      expect(UserName.safeParse(name).success).toBe(true);
    }
  });

  test("前後に空白がある場合、落とさずそのまま通すこと", () => {
    // 検証だけして値は変えないのが値オブジェクトの役目。`.trim()` を足すと
    // クライアントが送った表記を復元できなくなる。
    const padded = "  太郎  ";
    expect(String(UserName.parse(padded))).toBe(padded);
  });

  test("サロゲートペアを含む場合、**UTF-16 コードユニットで数えること** (契約の書き方とはズレる)", () => {
    // zod の `.max()` は `String.prototype.length` を見るので、サロゲートペアが
    // 2 つに数えられる。一方 OpenAPI の `maxLength` は「コードポイント数」と
    // 定義されているため、**契約は 🐈 を 51 匹まで許すと読める**のに実装は弾く。
    //
    // 500 にはならない。プレゼンテーション層の生成 zod も同じ `.length` で
    // 数えるので、ドメインに届く前に 400 になる (実測で確認済み)。
    // 直すには生成コードにも手を入れる必要があり、割に合わないので現状を固定する。
    const cats = "🐈".repeat(51);
    expect([...cats]).toHaveLength(51); // コードポイントでは 51
    expect(cats).toHaveLength(102); // コードユニットでは 102
    expect(UserName.safeParse(cats).success).toBe(false);

    // 50 匹 = 100 コードユニットならぎりぎり通る。
    expect(UserName.safeParse("🐈".repeat(50)).success).toBe(true);
  });
});
