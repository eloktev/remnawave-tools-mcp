import assert from "node:assert/strict";
import test from "node:test";
import { allOperations, classifyOperation, parseToolName, toolNameFor } from "../src/catalog.js";

test("classifies representative operations", () => {
  assert.equal(classifyOperation("system", "get_health"), "read");
  assert.equal(classifyOperation("system", "generate_x25519_keypairs"), "mutation");
  assert.equal(classifyOperation("users", "get_by_short_uuid"), "sensitive-read");
  assert.equal(classifyOperation("users", "list"), "sensitive-read");
  assert.equal(classifyOperation("users", "list_tags"), "read");
  assert.equal(classifyOperation("subscriptions", "get_raw_by_short_uuid"), "sensitive-read");
  assert.equal(classifyOperation("nodes", "list"), "sensitive-read");
  assert.equal(classifyOperation("nodes", "get"), "sensitive-read");
  assert.equal(classifyOperation("profiles", "list"), "sensitive-read");
  assert.equal(classifyOperation("profiles", "update"), "mutation");
  assert.equal(classifyOperation("profiles", "delete"), "mutation");
  assert.equal(classifyOperation("hosts", "get"), "sensitive-read");
  assert.equal(classifyOperation("nodes", "restart"), "mutation");
  assert.equal(classifyOperation("hwid", "create_device"), "mutation");
  assert.equal(classifyOperation("bandwidth_stats", "get_user_usage"), "read");
});

test("generates and parses all tool names", () => {
  for (const operation of allOperations()) {
    const toolName = toolNameFor(operation.domain, operation.operation);
    assert.equal(toolName, operation.toolName);
    assert.deepEqual(parseToolName(toolName), { domain: operation.domain, operation: operation.operation });
  }
});
