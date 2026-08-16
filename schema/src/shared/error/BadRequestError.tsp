import "../model/index.tsp";
import "./ErrorItem.tsp";
import "./ErrorTitle.tsp";

@summary("BadRequestError")
@doc("リクエスト内容が不正 (汎用)")
@error
@example(#{
  status: 400,
  code: "4000",
  title: "リクエスト内容が不正です",
  errors: #[
    #{ field: "mailAddress", message: "メールアドレスの形式が不正です" }
  ],
})
model BadRequestError {
  status: 400;
  code: "4000";
  title: ErrorTitle;
  errors?: ErrorItem[];
}
