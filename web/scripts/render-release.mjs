import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { patchDatabaseUrlForRenderPostgres } from "./render-postgres-env.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

patchDatabaseUrlForRenderPostgres();

const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
  cwd: root,
  shell: true,
});
if (r.error) {
  console.error(r.error);
  process.exit(1);
}
if (r.status !== 0) process.exit(r.status ?? 1);
