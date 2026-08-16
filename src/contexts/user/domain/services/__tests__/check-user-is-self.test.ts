import { describe, expect, test } from "bun:test";

import { UserId } from "../../model/value-objects/user-id";
import { checkUserIsSelf } from "../check-user-is-self";

const SELF = UserId.parse("019fa5bc-0000-7000-8000-000000000000");
const OTHER = UserId.parse("019fa5bc-2222-7000-8000-000000000000");

/**
 * 認可の業務ルールが素の `===` 一本に乗っている。コマンドとクエリの
 * 両方がここを通るので、壊れると全経路の認可が同時に壊れる。
 *
 * 表記ゆれで判定が割れないことは `Uuid` 側 (大文字を弾くこと) が担保している。
 * ここは canonical な id しか受け取らない前提で書く。
 */
describe(checkUserIsSelf.name, () => {
  test("対象と操作者が同じ場合、通すこと", () => {
    expect(checkUserIsSelf(SELF, SELF).isOk()).toBe(true);
  });

  test("他人の場合、ForbiddenError で落ちること", () => {
    // 404 ではなく 403。認可の失敗と不在を混ぜない。
    // タグがそのまま翻訳に使われるので、変えると認可の失敗が別の顔で出ていく。
    const result = checkUserIsSelf(OTHER, SELF);

    expect(result.isOk()).toBe(false);
    expect(result.isOk() ? null : result.error._tag).toBe("ForbiddenError");
  });

  test("引数の向きを入れ替えた場合でも、他人なら落ちること", () => {
    expect(checkUserIsSelf(SELF, OTHER).isOk()).toBe(false);
  });

  test("判定する場合、同期関数として完結すること (id を引き当てない)", () => {
    // 同期関数であること自体が「DB を引かない」の担保。引き当てを足すと
    // 認可の失敗が対象の有無に引きずられ、他人の id で 404 が出るようになる。
    expect(checkUserIsSelf(OTHER, SELF)).not.toBeInstanceOf(Promise);
  });
});
