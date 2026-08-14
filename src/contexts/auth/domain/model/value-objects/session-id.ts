import type * as z from "zod";

import { Uuid } from "~/shared/domain/model/uuid";
import { generateBrandedUuid } from "~/shared/domain/uuid-generator";

/**
 * ログインからログアウトまで不変の識別子。JWT の `sid` はこちら。
 * 券の id を載せると、古いアクセストークンを持つタブからのログアウトが空振りする。
 */
export const SessionId = Uuid.brand<"Auth.SessionId">();
export type SessionId = z.infer<typeof SessionId>;

export const generateSessionId = generateBrandedUuid(SessionId);
