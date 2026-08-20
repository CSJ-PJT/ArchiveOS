import assert from "node:assert/strict";
import { resolveWithin } from "./meshOverview.js";

const immediate = await resolveWithin(Promise.resolve("live"), "fallback", 50);
assert.equal(immediate, "live");

const rejected = await resolveWithin(Promise.reject(new Error("offline")), "fallback", 50);
assert.equal(rejected, "fallback");

const started = Date.now();
const timedOut = await resolveWithin(new Promise<string>(() => undefined), "fallback", 25);
assert.equal(timedOut, "fallback");
assert.ok(Date.now() - started < 250, "timeout fallback must stay bounded");

console.log("meshOverview timeout regression passed");
