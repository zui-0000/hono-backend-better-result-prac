import { TaggedError } from "better-result";

/**
 * リソースが存在しない (汎用 / errorCode 4040 / HTTP 404)。
 */
export class ResourceNotFoundError extends TaggedError(
  "ResourceNotFoundError",
)<{}> {}
