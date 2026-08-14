import * as z from "zod";

/** ユーザー名 (値オブジェクト / branded string)。1〜100 文字。 */
export const UserName = z.string().min(1).max(100).brand<"User.Name">();
export type UserName = z.infer<typeof UserName>;
