import { createHash } from "crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";

function hashDirectory(dir: string): string {
  const hash = createHash("sha256");

  function walk(d: string) {
    for (const entry of readdirSync(d).sort()) {
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else {
        hash.update(readFileSync(full));
      }
    }
  }

  walk(dir);
  return hash.digest("hex").slice(0, 12);
}

const distDir = join(import.meta.dirname, "..", "dist");
const version = hashDirectory(distDir);

writeFileSync(
  join(distDir, "version.json"),
  JSON.stringify({ version, timestamp: Date.now() }),
);

console.log(`Wrote version.json: ${version}`);
