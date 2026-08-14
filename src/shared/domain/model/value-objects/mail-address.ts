import * as z from "zod";

// schema の MailAddress と同一パターン (RFC 5322 準拠)。
const MAIL_ADDRESS_PATTERN =
  /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/u;

/**
 * メールアドレス (値オブジェクト / branded string)。
 * **検証だけを行い、値は変えない。** 利用者が名乗った表記をそのまま持つ。
 *
 * `z.email()` を使わないのは、**契約と判定がズレるから**。境界では契約から
 * 生成した zod (上と同じ regex) が検証し、ここは同じ値をドメインの型へ変える
 * だけなので、両者が食い違うと**契約を通った入力がここで throw して 500 になる**。
 * 実測で `a@b.c` と RFC 5322 の記号を含むアドレスが該当した。
 * 契約は OpenAPI の `pattern` として出るので、zod の実装には寄せられない。
 *
 * 小文字へ正規化しないのは、潰すと元の表記を復元できないから。RFC 5321 §2.4 は
 * ローカル部の大小保存を要求しており、区別する受信サーバへ送ると届かなくなる。
 * 大小違いの重複は DB 側の `lower(mail_address)` 一意索引で防ぐ。
 *
 * 正規化しないので **MailAddress 同士を素の `===` で比べてはいけない**
 * (大小違いが別物になる)。同一性の判定はすべて DB 側にある。
 */
export const MailAddress = z
  .string()
  .max(255)
  .regex(MAIL_ADDRESS_PATTERN)
  .brand<"MailAddress">();
export type MailAddress = z.infer<typeof MailAddress>;
