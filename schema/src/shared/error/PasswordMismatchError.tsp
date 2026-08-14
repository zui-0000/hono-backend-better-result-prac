import "../model/index.tsp";
import "./ErrorCode.tsp";
import "./ErrorMessage.tsp";

// パスワード変更でのみ返す。汎用の 401 (UnauthorizedError) と分けておくと、
// クライアントが打ち間違いとして扱える (トークンの更新やログアウトへ倒さない)。
//
// 認証の失敗理由を書き分けないという方針の例外にあたる。許されるのは、
// この応答を受け取る時点で相手が本人だと既に証明済みだから (Bearer は通っている)。
// 自分のパスワードを打ち間違えたと伝えても、その人が知らない情報は漏れない。
@summary("PasswordMismatchError")
@doc("現在のパスワードが一致しない")
@error
@example(#{ errorCode: "4011", message: "現在のパスワードが正しくありません" })
model PasswordMismatchError {
  errorCode: ErrorCode;
  message: ErrorMessage;
}
