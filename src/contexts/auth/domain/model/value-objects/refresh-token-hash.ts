import * as z from "zod";

/** SHA-256 の 16 進表現。券そのものは保存せず、この形にして記録する。 */
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/u;

export const RefreshTokenHash = z
  .string()
  .regex(SHA256_HEX_PATTERN)
  .brand<"Auth.RefreshTokenHash">();
export type RefreshTokenHash = z.infer<typeof RefreshTokenHash>;
