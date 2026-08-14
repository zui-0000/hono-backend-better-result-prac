import * as z from "zod";

// UUID v7 の形式 (TypeSpec schema 側の Uuid と同一パターン)。
const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

/**
 * UUID v7 形式の文字列スキーマ (未 brand・共有ドメイン)。
 *
 * 各集約の id 値オブジェクトは、これに固有の brand を重ねて定義する:
 *   export const UserId = Uuid.brand<"User.Id">();
 *
 * value-objects/ に入れないのは、このリポジトリで値オブジェクトの目印が brand
 * (名目的型付け) であり、Uuid はそれを持たないから。単体では意味を成さず、
 * brand を重ねて初めて値オブジェクトになる素材。
 */
export const Uuid = z.string().regex(UUID_V7_PATTERN);
