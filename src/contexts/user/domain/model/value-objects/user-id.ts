import type * as z from "zod";

import { Uuid } from "~/shared/domain/model/uuid";
import { generateBrandedUuid } from "~/shared/domain/uuid-generator";

/**
 * ユーザーの識別子 (値オブジェクト / branded uuidv7)。形式検証は共有ドメインの Uuid。
 *
 * エクスポート名を集約で修飾する (UserId) のは、バレルを置かず各ファイルから直接
 * import する方針のため。名前だけで文脈が分かる必要がある。brand タグも同じ理由で
 * グローバル一意にしておく。
 */
export const UserId = Uuid.brand<"User.Id">();
export type UserId = z.infer<typeof UserId>;

/** 新規ユーザーの識別子を採番する (共有ヘルパーに委譲)。 */
export const generateUserId = generateBrandedUuid(UserId);
