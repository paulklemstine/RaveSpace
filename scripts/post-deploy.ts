import { createHash } from "crypto";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

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

  // Use Application Default Credentials (gcloud auth)
  const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const app = initializeApp(
    serviceAccount
      ? {
          credential: cert(
            JSON.parse(
              readFileSync(serviceAccount, "utf-8"),
            ) as ServiceAccount,
          ),
          databaseURL:
            "https://collabboard-8c0d0-default-rtdb.firebaseio.com/",
        }
      : {
          databaseURL:
            "https://collabboard-8c0d0-default-rtdb.firebaseio.com/",
        },
  );

  const db = getDatabase(app);
  await db.ref("ravespace/version").set(version);
  console.log(`Deployed version: ${version}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
