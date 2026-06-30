import assert from "node:assert/strict";
import test from "node:test";
import { jsonResult } from "../src/server.js";
import { classifyOperation } from "../src/catalog.js";

test("mutation class remains blocked by default", () => {
  assert.equal(classifyOperation("nodes", "restart"), "mutation");
  const blocked = jsonResult({
    error: {
      code: "LOCAL_MUTATION_BLOCKED",
      kind: "safety",
      message: "This Remnawave operation is mutating and local mutation execution is disabled.",
      retryable: false,
    },
  });
  const text = blocked.content[0].text;
  assert.match(text, /LOCAL_MUTATION_BLOCKED/);
});
