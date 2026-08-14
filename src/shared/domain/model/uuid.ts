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
 * `z.uuidv7()` を使わないのは、**あれが大文字を通すから**（実測）。他は契約と同じ
 * 厳しさだが、この 1 点だけ緩い。緩いほうへズレると **id の表記が 2 通り生まれる**
 * のがまずい。`checkUserIsSelf` は id を素の `===` で比べるので、
 * 大小が混ざると**本人なのに 403** になる。しかも緑のまま通るので気付けない。
 * (`z.uuid()` は版を問わないため v4 も nil UUID も通る。こちらは論外)
 *
 * value-objects/ に入れないのは、このリポジトリで値オブジェクトの目印が brand
 * (名目的型付け) であり、Uuid はそれを持たないから。単体では意味を成さず、
 * brand を重ねて初めて値オブジェクトになる素材。
 */
export const Uuid = z.string().regex(UUID_V7_PATTERN);
