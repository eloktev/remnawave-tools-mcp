import assert from "node:assert/strict";
import test from "node:test";
import {
  dangerousMutationConfirmed,
  isDangerousMutation,
  normalizeOperationInput,
  operationInputSchema,
  operatorTarget,
} from "../src/schemas.js";

test("priority operation schemas expose typed fields", () => {
  assert.ok(operationInputSchema("nodes", "get").uuid);
  assert.ok(operationInputSchema("nodes", "update").address);
  assert.ok(operationInputSchema("users", "get_by_username").username);
  assert.ok(operationInputSchema("users", "update").activeInternalSquads);
  assert.ok(operationInputSchema("internal_squads", "add_users").userUuids);
  assert.ok(operationInputSchema("external_squads", "add_users").userUuids);
});

test("normalizes typed args into an upstream payload", () => {
  const input = normalizeOperationInput({
    uuid: "node-1",
    address: "203.0.113.10",
    data: { name: "edge-a" },
    payload: { providerUuid: "provider-1" },
    responseMode: "normalized",
    mutationApproved: true,
  });
  assert.deepEqual(input.payload, {
    providerUuid: "provider-1",
    name: "edge-a",
    uuid: "node-1",
    address: "203.0.113.10",
  });
  assert.equal(input.responseMode, "normalized");
  assert.equal(input.mutationApproved, true);
});

test("dangerous mutations require the exact operation confirmation phrase", () => {
  assert.equal(isDangerousMutation("users", "delete"), true);
  assert.equal(isDangerousMutation("nodes", "restart"), false);
  assert.equal(dangerousMutationConfirmed("users", "delete"), false);
  assert.equal(dangerousMutationConfirmed("users", "delete", "CONFIRM"), false);
  assert.equal(dangerousMutationConfirmed("users", "delete", "confirm users.delete"), true);
});

test("operator tools route to concrete upstream operations", () => {
  assert.deepEqual(
    operatorTarget("remnawave_squad_add_users", {
      squadType: "external",
      squadUuid: "squad-1",
      userUuids: ["user-1"],
    }),
    {
      domain: "external_squads",
      operation: "add_users",
      payload: { squadUuid: "squad-1", userUuids: ["user-1"] },
    },
  );

  assert.deepEqual(
    operatorTarget("remnawave_user_set_squads", {
      uuid: "user-1",
      activeInternalSquads: ["squad-a"],
      mutationApproved: true,
    }),
    {
      domain: "users",
      operation: "update",
      payload: { uuid: "user-1", activeInternalSquads: ["squad-a"] },
    },
  );
});
