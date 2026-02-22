import { createHash } from "crypto";
import { readdirSync, readFileSync, statSync } from "fs";
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

async function main() {
  const distDir = join(import.meta.dirname, "..", "dist");
  const version = hashDirectory(distDir);

  // Write version to RTDB via REST API (path is publicly writable)
  const url =
    "https://collabboard-8c0d0-default-rtdb.firebaseio.com/ravespace/version.json";
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(version),
  });

  if (!res.ok) {
    throw new Error(`Failed to write version: ${res.status} ${await res.text()}`);
  }

  console.log(`Version stamped: ${version} — connected displays will auto-reload`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
