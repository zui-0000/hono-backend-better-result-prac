import "../model/index.tsp";
import "./ErrorTitle.tsp";

@summary("ResourceNotFoundError")
@doc("リソースが存在しない (汎用)")
@error
@example(#{
  status: 404,
  code: "4040",
  title: "指定されたリソースは存在しません",
})
model ResourceNotFoundError {
  status: 404;
  code: "4040";
  title: ErrorTitle;
}
