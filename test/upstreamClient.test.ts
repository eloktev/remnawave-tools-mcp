import assert from "node:assert/strict";
import test from "node:test";
import { UpstreamClient } from "../src/upstreamClient.js";

test("connects to fake upstream and forwards remnawave_api calls", async () => {
  process.env.REMNAWAVE_BASE_URL = "https://example.invalid";
  process.env.REMNAWAVE_API_TOKEN = "test-token";
  process.env.REMNAWAVE_VERSION = "2.7.4";
  process.env.REMNAWAVE_UPSTREAM_COMMAND = process.execPath;
  process.env.REMNAWAVE_UPSTREAM_ARGS = "dist/test/fakeUpstream.js";
  process.env.REMNAWAVE_TOOLS_DISCOVERY_TIMEOUT_MS = "5000";

  const client = new UpstreamClient();
  try {
    await client.assertReady();
    const tools = await client.listTools();
    assert.equal(tools.some((tool) => tool.name === "remnawave_api"), true);

    const result = await client.call("system", "get_health", {}, "normalized");
    const body = JSON.parse(result.content[0].type === "text" ? result.content[0].text : "{}");
    assert.equal(body.ok, true);
    assert.deepEqual(body.args, {
      domain: "system",
      operation: "get_health",
      payload: {},
      responseMode: "normalized",
    });
  } finally {
    await client.close();
  }
});
