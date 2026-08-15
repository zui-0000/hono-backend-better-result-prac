import { drizzle } from "drizzle-orm/bun-sql";

/**
 * 接続を張る。**URL の検証は呼び出し側 (合成ルート) の仕事。**
 *
 * `Bun.sql` は未設定の URL をエラーにせず既定の接続先へフォールバックするため、
 * 設定漏れが「起動しない」ではなく「**別の DB に繋がる**」に化ける。
 * だから起動時に読んで検証しきる (`main.ts`)。
 */
export const database = (url: string) => drizzle(url);

/**
 * Drizzle のクライアント。アダプタはこの型だけを知る (ドライバは隠す)。
 *
 * `BunSQLDatabase` を直に書かないのは、`$client` (接続を閉じる口) が
 * `drizzle()` の戻り値にしか生えていないため。
 */
export type Database = ReturnType<typeof database>;

/** 接続を閉じる (終了時)。 */
export const closeDatabase = async (db: Database): Promise<void> => {
  await db.$client.close();
};
