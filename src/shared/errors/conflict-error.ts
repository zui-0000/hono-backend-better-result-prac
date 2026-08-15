import { TaggedError } from "better-result";

import type { ErrorTitle } from "~/shared/presentation/constants/error-title";

/**
 * リソースの現在の状態と衝突する (汎用 / code 4090 / HTTP 409)。
 * 具体的な事由がある衝突は専用エラー (例: MailAddressDuplicationError) を使う。
 *
 * **まだ `new` される場所は無い。** 汎用の 409 という席を先に用意してあるだけで、
 * 翻訳表には登録済み。事由が分かっている衝突は専用エラーを足すほうが先になるので、
 * これが使われるのは「分岐する必要が無い衝突」が出てきたとき。
 */
export class ConflictError extends TaggedError("ConflictError")<{
  readonly title: ErrorTitle;
}> {}
