import "../model/index.tsp";
import "./ErrorCode.tsp";
import "./ErrorTitle.tsp";

@summary("UnauthorizedError")
@doc("認証情報が不正 (汎用)")
@error
@example(#{ status: 401, code: "4010", title: "認証情報が正しくありません" })
model UnauthorizedError {
  status: 401;
  code: ErrorCode;
  title: ErrorTitle;
}
