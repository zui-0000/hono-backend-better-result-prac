import "./Uuid.tsp";

@summary("RequestId")
@doc("リクエストの相関ID (UUID v7)。クライアントが採番するとログを突き合わせて追跡できる。省略・不正な形式ならサーバーが採番する")
@example("018eef15-1234-7123-8123-123456789abc")
scalar RequestId extends Uuid;
