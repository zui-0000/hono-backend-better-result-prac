import type * as z from "zod";

import { Uuid } from "~/shared/domain/model/uuid";

/** ユーザーの識別子 (値オブジェクト / branded uuidv7)。形式検証は共有ドメインの Uuid。 */
export const UserId = Uuid.brand<"User.Id">();
export type UserId = z.infer<typeof UserId>;
