import { app } from "~/app";
import { appDeps } from "~/app-deps";

/**
 * エントリ。**環境を渡すだけ。**
 *
 * どの実装を使うか、設定をどう読むかは合成ルート (`app-deps.ts` とその一群) が持つ。
 * ここが知っているのは「環境は `process.env` から来る」ことだけで、
 * 設定漏れは `requireEnv` が起動時に落とす。
 */
export default app(appDeps(process.env));
