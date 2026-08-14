import { TaggedError } from "better-result";

import type { MailAddress } from "~/shared/domain/model/value-objects/mail-address";

/**
 * メールアドレスが既に使用されている (errorCode 4091 / HTTP 409)。
 */
export class MailAddressDuplicationError extends TaggedError(
  "MailAddressDuplicationError",
)<{
  readonly mailAddress: MailAddress;
}> {}
