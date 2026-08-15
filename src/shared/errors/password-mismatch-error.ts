import { TaggedError } from "better-result";

/**
 * 現在のパスワードが一致しない (code 4011 / HTTP 401)。
 * パスワード変更でのみ返す、打ち間違いを伝えるための専用エラー。
 *
 * 名前に「現在の」を入れないのは、返す側の `verifyUserPassword` が User 集約の
 * 関数で、変更の文脈を知らないため (文言のほうは応答の文脈で決める)。
 */
export class PasswordMismatchError extends TaggedError(
  "PasswordMismatchError",
)<{}> {}
