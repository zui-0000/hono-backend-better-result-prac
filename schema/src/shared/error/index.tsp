// エラーコードは `<HTTP ステータス><連番>` の 4 桁。**各エラーがリテラルで持つ。**
//
// 以前は `scalar ErrorCode extends string` を共有し、実際の値は `@example` に
// 書いていた。だが example は制約ではないので、**同じステータスの 2 つ (4010 と 4011) を
// クライアントが型で区別できなかった** — 分けた目的そのものが契約で表現できていない状態。
// リテラルにすると生成物が `zod.literal("4011")` になり、判別できる直和になる。
//
// 「先頭 3 桁 = 作られたときのステータス」は実装側の
// `handle-error-response.test.ts` が固定している。

import "./ErrorTitle.tsp";
import "./ErrorItem.tsp";
import "./BadRequestError.tsp";
import "./ConflictError.tsp";
import "./ForbiddenError.tsp";
import "./InternalServerError.tsp";
import "./MailAddressDuplicationError.tsp";
import "./PasswordMismatchError.tsp";
import "./ResourceNotFoundError.tsp";
import "./UnauthorizedError.tsp";
