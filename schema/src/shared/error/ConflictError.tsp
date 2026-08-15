import "../model/index.tsp";
import "./ErrorCode.tsp";
import "./ErrorTitle.tsp";

@summary("ConflictError")
@doc("リソースの現在の状態と衝突する (汎用)")
@error
@example(#{
  status: 409,
  code: "4090",
  title: "リソースの現在の状態と衝突します",
})
model ConflictError {
  status: 409;
  code: ErrorCode;
  title: ErrorTitle;
}
