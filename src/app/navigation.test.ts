import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalManagedSystemId,
  parseConsoleLocation,
  servicesHash,
} from "./navigation.ts";

test("services route defaults to service status", () => {
  assert.deepEqual(parseConsoleLocation("#/services"), {
    route: "services",
    servicesView: "status",
    managedSystemId: null,
    canonicalHash: "#/services",
  });
});

test("legacy managed route opens the managed systems subview", () => {
  assert.deepEqual(parseConsoleLocation("#/managed"), {
    route: "services",
    servicesView: "managed",
    managedSystemId: null,
    canonicalHash: "#/services?view=managed",
  });
});

test("managed detail URL survives reload and normalizes Logistics alias", () => {
  const location = parseConsoleLocation("#/services?view=managed&system=archive-logitics");
  assert.equal(location.route, "services");
  assert.equal(location.servicesView, "managed");
  assert.equal(location.managedSystemId, "archive-logistics");
  assert.equal(location.canonicalHash, "#/services?view=managed&system=archive-logistics");
  assert.equal(parseConsoleLocation(location.canonicalHash).managedSystemId, "archive-logistics");
});

test("unknown service view and unknown system fail safely", () => {
  assert.equal(parseConsoleLocation("#/services?view=unknown").canonicalHash, "#/services");
  assert.equal(parseConsoleLocation("#/services?view=managed&system=archive-world").managedSystemId, null);
  assert.equal(canonicalManagedSystemId("deepstake"), null);
});

test("services hash emits only canonical managed identities", () => {
  assert.equal(servicesHash("managed", "archive-logitics"), "#/services?view=managed&system=archive-logistics");
  assert.equal(servicesHash("external", "archive-logistics"), "#/services?view=external");
});
