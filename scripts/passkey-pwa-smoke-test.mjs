import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const required = [
  "public/manifest.webmanifest",
  "public/service-worker.js",
  "src/lib/passkeys.ts",
  "archiveos-ai/src/main/resources/db/migration/V39__create_passkey_credentials.sql",
];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing passkey/PWA artifact: ${file}`);
}

const manifest = JSON.parse(read("public/manifest.webmanifest"));
if (manifest.display !== "standalone" || !String(manifest.start_url).includes("#/dashboard")) {
  throw new Error("PWA manifest is not installable as the ArchiveOS dashboard.");
}

const migration = read("archiveos-ai/src/main/resources/db/migration/V39__create_passkey_credentials.sql").toLowerCase();
if (!migration.includes("public_key bytea") || migration.includes(" public_key blob")) {
  throw new Error("Passkey credential storage must use PostgreSQL bytea, never Large Objects.");
}

const serviceWorker = read("public/service-worker.js");
if (!serviceWorker.includes('request.method !== "GET"') || !serviceWorker.includes('url.pathname.startsWith("/api/")')) {
  throw new Error("Service worker must never cache mutating requests or API data.");
}

console.log("Passkey/PWA smoke test passed.");
