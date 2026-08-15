import "@typespec/http";
import "../model/index.tsp";

using TypeSpec.Http;

// **任意にしてある。** これはログを突き合わせるための値で、業務の入力ではない。
// 有無で応答が変わらないよう、送られてこなければサーバが採番する。
// 形が違う値も同じ扱い — ログ検索のための飾りで本文を落とさない。
@doc("全リクエストに共通するヘッダ")
model CommonHeaders {
  @doc("リクエストの相関ID。送らなければサーバが採番する")
  @header("X-Request-Id")
  requestId?: RequestId;
}
