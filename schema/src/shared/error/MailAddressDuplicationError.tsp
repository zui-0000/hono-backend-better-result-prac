import "../model/index.tsp";
import "./ErrorTitle.tsp";

@summary("MailAddressDuplicationError")
@doc("メールアドレスが既に使用されている")
@error
@example(#{
  status: 409,
  code: "4091",
  title: "メールアドレスが既に使用されています",
})
model MailAddressDuplicationError {
  status: 409;
  code: "4091";
  title: ErrorTitle;
}
