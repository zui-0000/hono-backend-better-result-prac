import { describe, expect, test } from "bun:test";

import { UserId } from "../../model/value-objects/user-id";
import { checkUserIsSelf } from "../check-user-is-self";

const SELF = UserId.parse("019fa5bc-0000-7000-8000-000000000000");
const OTHER = UserId.parse("019fa5bc-2222-7000-8000-000000000000");

describe(checkUserIsSelf.name, () => {
  test("本人なら通ること", () => {
    expect(checkUserIsSelf(SELF, SELF).isOk()).toBe(true);
  });

  test("他人なら ForbiddenError で落ちること", () => {
    const result = checkUserIsSelf(SELF, OTHER);

    expect(result.isOk()).toBe(false);
    // 404 ではなく 403。認可の失敗と不在を混ぜない。
    expect(result.isOk() ? null : result.error._tag).toBe("ForbiddenError");
  });
});
