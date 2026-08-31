import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const required = [
  "public/manifest.webmanifest",
  "public/service-worker.js",
  "src/lib/passkeys.ts",
  "archiveos-ai/src/main/resources/db/migration/V39__create_passkey_credentials.sql",
  "archiveos-ai/src/main/resources/db/migration/V40__add_managed_account_recovery.sql",
];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing passkey/PWA artifact: ${file}`);
}

const manifest = JSON.parse(read("public/manifest.webmanifest"));
if (manifest.display !== "standalone" || !String(manifest.start_url).includes("pwa-install=1#/dashboard")) {
  throw new Error("PWA manifest is not installable as the ArchiveOS dashboard.");
}

const migration = read("archiveos-ai/src/main/resources/db/migration/V39__create_passkey_credentials.sql").toLowerCase();
if (!migration.includes("public_key bytea") || migration.includes(" public_key blob")) {
  throw new Error("Passkey credential storage must use PostgreSQL bytea, never Large Objects.");
}

const serviceWorker = read("public/service-worker.js");
if (!serviceWorker.includes('request.method !== "GET"') || !serviceWorker.includes('url.pathname.startsWith("/api/")') || !serviceWorker.includes('cache: "no-store"')) {
  throw new Error("Service worker must never cache mutating requests or API data.");
}

const main = read("src/main.tsx");
const app = read("src/App.tsx");
if (!main.includes('updateViaCache: "none"') || !app.includes("archiveos.app.release") || !app.includes("앱 다시 설치 준비")) {
  throw new Error("Installed ArchiveOS must detect and repair a production release mismatch.");
}

const backend = read("backend/src/server.ts");
if (!backend.includes('path === "/login/webauthn" ? "manual"') || !backend.includes('method: "PASSKEY"')) {
  throw new Error("Passkey authentication must preserve Spring Security's session cookie across the proxy.");
}

const settings = read("src/pages/SettingsPage.tsx");
if (!settings.includes("ID 찾기") || !settings.includes("비밀번호 찾기") || !settings.includes("계정 관리")) {
  throw new Error("Managed account recovery UI is incomplete.");
}

const passkeys = read("src/lib/passkeys.ts");
if (!passkeys.includes("embeddedBrowserForPasskeys") || !passkeys.includes("다른 브라우저로 열기")) {
  throw new Error("Embedded-browser passkey failure must be handled before WebAuthn registration.");
}

console.log("Passkey/PWA smoke test passed.");
