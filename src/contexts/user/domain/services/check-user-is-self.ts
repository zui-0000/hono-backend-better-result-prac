import { Result } from "better-result";

import { ForbiddenError } from "~/shared/errors/forbidden-error";

import type { UserId } from "../model/value-objects/user-id";

/**
 * 操作の対象が、操作している本人かを検証する (ドメインサービス)。
 * 「利用者は自分自身の情報だけを変更できる」という業務ルールを担う。
 *
 * **認可の規則はビジネスルール**であって HTTP や presentation の都合ではない。
 * 集約 1 つを見ても判断できない (対象と actor という 2 つの id が要る) ので、
 * 集約にも値オブジェクトにも属さない。
 *
 * 規則がまだ 1 つしかないのでポリシーオブジェクトにはしていない。ロールや
 * 「管理者は他人も編集できる」が出てきたら、ここが自然にポリシーへ育つ。
 *
 * クエリ側も同じものを使う。読み取りを「引く範囲を絞る」形で認可すると、
 * **認可の失敗が 0 件 → 404 になる**。「認可の失敗は対象の有無に関わらず 403」と
 * 決めたので、コマンドとクエリで規則の表現が割れないことを優先した。
 */
export const checkUserIsSelf = (
  target: UserId,
  actor: UserId,
): Result<void, ForbiddenError> =>
  target === actor ? Result.ok() : Result.err(new ForbiddenError());
