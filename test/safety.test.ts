import assert from "node:assert/strict";
import test from "node:test";
import { buildUpstreamEnv } from "../src/upstreamClient.js";
import { rawAllowed, redactToolResult } from "../src/server.js";

test("upstream env uses an allowlist plus Remnawave vars", () => {
  process.env.UNRELATED_SECRET_TOKEN = "must-not-pass";
  process.env.PATH = process.env.PATH ?? "/usr/bin";
  const env = buildUpstreamEnv({
    REMNAWAVE_BASE_URL: "https://example.invalid",
    REMNAWAVE_API_TOKEN: "token",
    REMNAWAVE_VERSION: "2.7.4",
  });
  assert.equal(env.REMNAAWAVE_API_TOKEN, undefined);
  assert.equal(env.REMNAWAVE_API_TOKEN, "token");
  assert.equal(env.UNRELATED_SECRET_TOKEN, undefined);
  assert.ok(env.PATH);
});

test("raw mode is allowed only for safe system reads", () => {
  assert.equal(rawAllowed("system", "get_health"), true);
  assert.equal(rawAllowed("system", "get_stats"), true);
  assert.equal(rawAllowed("users", "get"), false);
  assert.equal(rawAllowed("subscriptions", "get_raw_by_short_uuid"), false);
  assert.equal(rawAllowed("nodes", "restart"), false);
});

test("redacts sensitive MCP text results", () => {
  const result = redactToolResult({
    content: [
      {
        type: "text",
        text: JSON.stringify({
          uuid: "user-uuid",
          shortUuid: "abc123",
          shortIds: ["deadbeefcafebabe"],
          subscriptionUrl: "https://sub.example/abc123",
          nested: { publicName: "ok", privateKey: "secret-value" },
        }),
      },
    ],
  });
  const text = result.content[0].type === "text" ? result.content[0].text : "";
  assert.match(text, /\[REDACTED\]/);
  assert.doesNotMatch(text, /sub\.example/);
  assert.doesNotMatch(text, /secret-value/);
  assert.doesNotMatch(text, /deadbeefcafebabe/);
  assert.match(text, /publicName/);
});
