import "../model/index.tsp";
import "./ErrorTitle.tsp";

@summary("InternalServerError")
@doc("サーバー内部で予期せぬエラーが発生した (汎用)")
@error
@example(#{
  status: 500,
  code: "5000",
  title: "サーバーで予期せぬエラーが発生しました",
})
model InternalServerError {
  status: 500;
  code: "5000";
  title: ErrorTitle;
}
