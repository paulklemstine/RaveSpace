import { createHash } from "crypto";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

// Load .env from project root (simple key=value parser, no extra dep)
function loadEnv(path: string): void {
  const content = readFileSync(path, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnv(join(import.meta.dirname, "..", ".env"));

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

  const app = initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
    databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  });

  const db = getDatabase(app);
  await set(ref(db, "ravespace/version"), version);
  console.log(`Deployed version: ${version}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
