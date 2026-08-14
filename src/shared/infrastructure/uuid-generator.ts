import type { UuidGenerator } from "~/shared/domain/uuid-generator";

/** 本番実装: Bun ネイティブの uuidv7 を採番する。 */
export const bunUuidGenerator: UuidGenerator = {
  next: () => Bun.randomUUIDv7(),
};
