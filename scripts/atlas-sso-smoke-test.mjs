import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const settings = await readFile(new URL("../src/pages/SettingsPage.tsx", import.meta.url), "utf8");
const api = await readFile(new URL("../src/lib/backendApi.ts", import.meta.url), "utf8");
const proxy = await readFile(new URL("../backend/src/server.ts", import.meta.url), "utf8");

assert.match(settings, /Atlas 단방향 SSO/);
assert.match(settings, /Atlas SSO 권한/);
assert.match(settings, /authorizeAtlasSso/);
assert.match(api, /ARCHIVEOS_TO_ATLAS_ONLY/);
assert.match(proxy, /\/api\/auth\/sso\/exchange/);
assert.doesNotMatch(settings, /Atlas.*비밀번호/);
console.log("Atlas one-way SSO smoke test passed.");
