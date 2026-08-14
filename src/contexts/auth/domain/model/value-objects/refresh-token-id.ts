import type * as z from "zod";

import { Uuid } from "~/shared/domain/model/uuid";

/** 券 1 枚の識別子。ローテーションのたびに変わる (セッションとは別物)。 */
export const RefreshTokenId = Uuid.brand<"Auth.RefreshTokenId">();
export type RefreshTokenId = z.infer<typeof RefreshTokenId>;
