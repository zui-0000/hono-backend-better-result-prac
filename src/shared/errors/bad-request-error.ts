import { TaggedError } from "better-result";

import type { ErrorTitle } from "~/shared/presentation/constants/error-title";

import type { ErrorItem } from "./error-item";

/**
 * リクエスト内容が不正 (汎用 / code 4000 / HTTP 400)。
 * 入力値の検証失敗などを表す。
 *
 * 表題を `message` ではなく `title` で持つのは、応答の項目名に揃えるため。
 * `errors[].message` と同じ名前にすると、どちらの話か読む側が毎回考えることになる。
 * 引き換えに `TaggedError` が継承する `Error.message` は空のまま残る (実測)。
 * ログは `_tag` と `cause` を見ているので実害は無い。
 */
export class BadRequestError extends TaggedError("BadRequestError")<{
  readonly title: ErrorTitle;
  readonly errors?: readonly ErrorItem[];
}> {}
